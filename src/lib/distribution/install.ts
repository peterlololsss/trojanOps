// Owner: B. Partial patches are merged with the stored row before clamping against the selected version.
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { isUuid } from '../authz';
import { AppError, type Actor, type EffectiveAgent } from '../contracts';
import { getDb, type Tx } from '../db/client';
import { agentInstallations, quotaLimits } from '../db/schema';
import { setLimit } from '../gateway/quota';
import { effectiveAgent } from './effective-config';
import { active, audited, checkedWrite, clampWrite, ensurePublicBudget, clubBudget, invalid, lockClub, lockTemplate, missing, president, versionFor, type Installation, type Template } from './write-support';

export const installationPatchSchema = z.object({
  enabled: z.boolean().optional(), track: z.enum(['latest', 'pinned']).optional(), pinnedVersion: z.number().int().positive().nullable().optional(),
  audience: z.enum(['public', 'members', 'positions']).nullable().optional(), usableBy: z.array(z.string().min(1)).nullable().optional(),
  promptAddendum: z.string().optional(), extraSourceIds: z.array(z.uuid()).optional(), modelClass: z.enum(['standard', 'economy']).nullable().optional(),
  limitMicro: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();
export type InstallationPatch = z.infer<typeof installationPatchSchema>;
export async function updateInstallation(
  actor: Actor, installationId: string, input: InstallationPatch, expectOrgId?: string,
): Promise<EffectiveAgent> {
  return writeInstallation(actor, installationId, input, false, expectOrgId);
}

/** Shared locked writer also used by Publish to all students.
 *
 * `expectOrgId` is the club the caller believes the installation belongs to — the §14 path names
 * it, so a URL that points at one club and an installation in another must not quietly act on the
 * second. It is not the permission (that is `president` below); it only keeps the path honest. */
export async function writeInstallation(
  actor: Actor, installationId: string, input: InstallationPatch, publishPublic = false, expectOrgId?: string,
): Promise<EffectiveAgent> {
  const limitMicro = await checkedWrite(actor, 'installation', installationId, async () => {
    const prepare = async (tx: Tx, apply: boolean, chosenLimit?: number) => {
      const denied = () => new AppError({ code: 'forbidden', message: 'Only the president acting in this club can change its agents.' });
      if (!isUuid(installationId)) throw publishPublic ? denied() : missing();
      const [original] = await tx.select().from(agentInstallations).where(eq(agentInstallations.id, installationId));
      if (!original) throw publishPublic ? denied() : missing();
      // Same refusal as an unknown id, so a mismatched path cannot be used to probe which club
      // an installation belongs to.
      if (expectOrgId && original.orgId !== expectOrgId) throw publishPublic ? denied() : missing();
      president(actor, original.orgId);
      const template = await lockTemplate(tx, original.templateId); active(template);
      await lockClub(tx, original.orgId);
      const [current] = await tx.select().from(agentInstallations).where(eq(agentInstallations.id, installationId)).for('no key update');
      const parsed = installationPatchSchema.safeParse(input);
      if (!parsed.success) throw invalid(parsed.error.issues[0].message);
      const { limitMicro: requestedLimit, ...patch } = parsed.data;
      let limitMicro = chosenLimit ?? requestedLimit;
      let ownLimit: number | null = null;
      if (publishPublic) {
        const budget = await clubBudget(tx, current.orgId);
        if (budget <= 0) throw invalid('This club has no monthly AI quota yet. Ask USG to set one first.');
        ownLimit = await ownInstallationLimit(tx, installationId);
        // A stored 0 counts as absent: it would publish the agent and then block every run of
        // it, so the default applies instead.
        if (ownLimit !== null && ownLimit <= 0) ownLimit = null;
        limitMicro ??= ownLimit ?? Math.floor(budget / 2);
        if (limitMicro <= 0) throw invalid(`${template.name} would get a monthly budget of $0 and could not run. Choose a larger budget.`);
      }
      if (template.distribution === 'required' && patch.enabled === false) {
        throw new AppError({ code: 'clamp_violation', message: 'Required agents must remain enabled.', cap: { scope: 'installation', field: 'enabled', allowed: 'true' } });
      }
      const proposed = { ...current, ...patch };
      if (proposed.track === 'latest') proposed.pinnedVersion = null;
      const version = await versionFor(tx, template, proposed);
      const effective = await clampWrite(tx, current.orgId, version, { ...proposed, quotaMicro: limitMicro });

      // §8 reserves opening an agent to the whole campus for Publish to all students, which
      // checks the club has a budget, gives the installation one, and audits
      // agent.publish_public. Reaching the same state through a patch would skip all three and
      // leave D3 invisible in the audit views, so it is refused and pointed at the right door.
      if (!publishPublic && reachesCampus(proposed.enabled, effective.audience)) {
        const wasPublic = await alreadyPublic(tx, template, current);
        if (!wasPublic) {
          throw new AppError({
            code: 'clamp_violation',
            message: 'Use Publish to all students to open this agent to the whole campus.',
            cap: { scope: 'installation', field: 'audience', allowed: ['members', 'positions'] },
          });
        }
      }

      if (apply) {
        if (effective.audience === 'public' && limitMicro === undefined) await ensurePublicBudget(tx, actor, installationId, current.orgId);
        // Store what the clamps actually allow, not what was asked for: a usable_by list on a
        // members-wide agent clamps to empty, and a row that disagrees with its own effective
        // config misleads the admin page and the preview.
        await tx.update(agentInstallations)
          .set({ ...patch, ...(patch.usableBy === undefined ? {} : { usableBy: effective.usableBy }), pinnedVersion: proposed.pinnedVersion })
          .where(eq(agentInstallations.id, installationId));
      }
      // Nothing to set when the limit is already the one stored: re-stamping it would audit a
      // quota.limit.set the president never made.
      return { limitMicro, limitToSet: limitMicro === ownLimit ? undefined : limitMicro, orgId: current.orgId };
    };
    // A's quota writer owns its transaction. Release our locks before calling it, then re-lock
    // and re-clamp the fresh row/version before writing. If a concurrent edit invalidates the
    // candidate, only the unused quota change can survive; no invalid installation is stored.
    const plan = await getDb().transaction(tx => prepare(tx, false));
    if (plan.limitToSet !== undefined) await setLimit(actor, { scope: 'installation', orgId: plan.orgId, installationId, limitMicro: plan.limitToSet });
    await getDb().transaction(tx => prepare(tx, true, plan.limitMicro));
    return plan.limitMicro;
  }, publishPublic ? 'agent.publish_public' : 'installation.update');
  const updated = await effectiveAgent(installationId);
  await audited(actor, publishPublic ? 'agent.publish_public' : 'installation.update', 'installation', installationId, {
    ...(limitMicro === undefined ? {} : { limitMicro }),
    // What makes a D3 row readable: which agent, and how far it can now read.
    ...(publishPublic ? { templateSlug: updated.templateSlug, maxTier: updated.maxTier } : {}),
  });
  return updated;
}

/** Enabled and open to every signed-in student — the state Publish to all students owns. */
const reachesCampus = (enabled: boolean, audience: string) => enabled && audience === 'public';

/** The installation's own limit, as opposed to the club limit it falls back to; null when it has
 * no row of its own.
 *
 * TODO(verify): ask A to expose an own-limit flag on `remaining()`, so B stops reading
 * `quota_limits` directly. The null conditions mirror A's `limitRow` key, which `quota_limits` has
 * no check constraint to enforce. */
async function ownInstallationLimit(tx: Tx, installationId: string): Promise<number | null> {
  const [row] = await tx.select().from(quotaLimits)
    .where(and(eq(quotaLimits.scope, 'installation'), eq(quotaLimits.installationId, installationId), isNull(quotaLimits.userId)))
    .orderBy(desc(quotaLimits.setAt), desc(quotaLimits.createdAt)).limit(1);
  return row?.limitMicro ?? null;
}

/** Was this installation already on the campus directory before the patch? Clamped the same way a
 * read would clamp it, so a row the clamps now refuse counts as not public and the patch is
 * refused rather than waved through. */
async function alreadyPublic(tx: Tx, template: Template, current: Installation): Promise<boolean> {
  if (!current.enabled) return false;
  try {
    const version = await versionFor(tx, template, current);
    const before = await clampWrite(tx, current.orgId, version, current);
    return before.audience === 'public';
  } catch {
    return false;
  }
}
