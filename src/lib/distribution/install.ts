// Owner: B. Partial patches are merged with the stored row before clamping against the selected version.
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { isUuid } from '../authz';
import { AppError, type Actor, type EffectiveAgent } from '../contracts';
import { getDb, type Tx } from '../db/client';
import { agentInstallations, quotaLimits } from '../db/schema';
import { setLimit } from '../gateway/quota';
import { effectiveAgent } from './effective-config';
import { active, audited, checkedWrite, clampWrite, ensurePublicBudget, clubBudget, invalid, lockClub, lockTemplate, missing, president, versionFor } from './write-support';

export const installationPatchSchema = z.object({
  enabled: z.boolean().optional(), track: z.enum(['latest', 'pinned']).optional(), pinnedVersion: z.number().int().positive().nullable().optional(),
  audience: z.enum(['public', 'members', 'positions']).nullable().optional(), usableBy: z.array(z.string().min(1)).nullable().optional(),
  promptAddendum: z.string().optional(), extraSourceIds: z.array(z.uuid()).optional(), modelClass: z.enum(['standard', 'economy']).nullable().optional(),
  limitMicro: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
}).strict();
export type InstallationPatch = z.infer<typeof installationPatchSchema>;
export async function updateInstallation(actor: Actor, installationId: string, input: InstallationPatch): Promise<EffectiveAgent> {
  return writeInstallation(actor, installationId, input);
}

/** Shared locked writer also used by Publish to all students. */
export async function writeInstallation(actor: Actor, installationId: string, input: InstallationPatch, publishPublic = false): Promise<EffectiveAgent> {
  const limitMicro = await checkedWrite(actor, 'installation', installationId, async () => {
    const prepare = async (tx: Tx, apply: boolean, chosenLimit?: number) => {
      const denied = () => new AppError({ code: 'forbidden', message: 'Only the president acting in this club can change its agents.' });
      if (!isUuid(installationId)) throw publishPublic ? denied() : missing();
      const [original] = await tx.select().from(agentInstallations).where(eq(agentInstallations.id, installationId));
      if (!original) throw publishPublic ? denied() : missing();
      president(actor, original.orgId);
      const template = await lockTemplate(tx, original.templateId); active(template);
      await lockClub(tx, original.orgId);
      const [current] = await tx.select().from(agentInstallations).where(eq(agentInstallations.id, installationId)).for('no key update');
      const parsed = installationPatchSchema.safeParse(input);
      if (!parsed.success) throw invalid(parsed.error.issues[0].message);
      const { limitMicro: requestedLimit, ...patch } = parsed.data;
      let limitMicro = chosenLimit ?? requestedLimit;
      if (publishPublic) {
        const budget = await clubBudget(tx, current.orgId);
        if (budget <= 0) throw invalid('This club has no monthly AI quota yet. Ask USG to set one first.');
        const [own] = await tx.select().from(quotaLimits).where(and(eq(quotaLimits.scope, 'installation'), eq(quotaLimits.installationId, installationId)))
          .orderBy(desc(quotaLimits.setAt), desc(quotaLimits.createdAt)).limit(1);
        limitMicro ??= own?.limitMicro ? own.limitMicro : Math.floor(budget / 2);
        if (limitMicro <= 0) throw invalid(`${template.name} would get a monthly budget of $0 and could not run. Choose a larger budget.`);
      }
      if (template.distribution === 'required' && patch.enabled === false) {
        throw new AppError({ code: 'clamp_violation', message: 'Required agents must remain enabled.', cap: { scope: 'installation', field: 'enabled', allowed: 'true' } });
      }
      const proposed = { ...current, ...patch };
      if (proposed.track === 'latest') proposed.pinnedVersion = null;
      const version = await versionFor(tx, template, proposed);
      const effective = await clampWrite(tx, current.orgId, version, { ...proposed, quotaMicro: limitMicro });
      if (apply) {
        if (effective.audience === 'public' && limitMicro === undefined) await ensurePublicBudget(tx, actor, installationId, current.orgId);
        await tx.update(agentInstallations).set({ ...patch, pinnedVersion: proposed.pinnedVersion }).where(eq(agentInstallations.id, installationId));
      }
      return { limitMicro, orgId: current.orgId };
    };
    // A's quota writer owns its transaction. Release our locks before calling it, then re-lock
    // and re-clamp the fresh row/version before writing. If a concurrent edit invalidates the
    // candidate, only the unused quota change can survive; no invalid installation is stored.
    const plan = await getDb().transaction(tx => prepare(tx, false));
    if (plan.limitMicro !== undefined) await setLimit(actor, { scope: 'installation', orgId: plan.orgId, installationId, limitMicro: plan.limitMicro });
    await getDb().transaction(tx => prepare(tx, true, plan.limitMicro));
    return plan.limitMicro;
  });
  const updated = await effectiveAgent(installationId);
  await audited(actor, publishPublic ? 'agent.publish_public' : 'installation.update', 'installation', installationId, limitMicro === undefined ? {} : { limitMicro });
  return updated;
}
