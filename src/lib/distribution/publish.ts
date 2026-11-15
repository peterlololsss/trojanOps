// Owner: B (WP-5, real by H7). "Publish to all students" — demo beat D3, and the one §8 marks
// never cut: it is what a club can do here that a per-person AI account cannot.
import { and, eq } from 'drizzle-orm';
import { AppError, type Actor, type EffectiveAgent } from '../contracts';
import { getDb } from '../db/client';
import { agentInstallations, quotaLimits } from '../db/schema';
import { audit } from '../gateway/audit';
import { remaining, setLimit } from '../gateway/quota';
import { effectiveAgent } from './effective-config';
import { clampProposedChange, installationOrgId } from './queries';

/** What a published installation overrides. Its max tier is derived, not written: I4 forces a
 * public audience down to the public tier, and that is what keeps the club's minutes and budget
 * out of an agent the whole campus can now open. */
const PUBLIC_OVERRIDE: { audience: 'public'; usableBy: string[] } = { audience: 'public', usableBy: [] };

/**
 * An installation's own limit, as opposed to the club's limit it falls back to; null when it has
 * no row. TODO(verify): ask A to expose an own-limit flag on `remaining()`, so this read of
 * `quota_limits` can go.
 */
async function ownInstallationLimit(installationId: string): Promise<number | null> {
  const [row] = await getDb()
    .select({ limitMicro: quotaLimits.limitMicro })
    .from(quotaLimits)
    .where(and(eq(quotaLimits.scope, 'installation'), eq(quotaLimits.installationId, installationId)))
    .limit(1);
  return row?.limitMicro ?? null;
}

/**
 * Sets the installation's audience to public and enables it (§8).
 *
 * The president is checked first, so a missing installation and another club's installation get
 * the same denial: the answer is not a way to find out which ids exist (as `setLimit` does it).
 *
 * The clamps run **before** the write. A version published only to members cannot be widened to
 * the campus (I7), and writing first would leave a row that no later read can clamp — which would
 * throw out of `directory()` and `myAgents()` for every student, not just this club.
 *
 * §8 also requires an installation limit, so an outside student cannot drain the club's budget
 * (decision 7). The president's figure wins; otherwise an existing limit is kept; otherwise it
 * defaults to half the club's monthly quota. The limit is checked and written *before* the row
 * changes: a public installation without one would fall back to the club's whole budget, whereas a
 * refused publish leaves at most an unused limit row, which a retry reuses.
 */
export async function publishToAllStudents(
  actor: Actor,
  installationId: string,
  input: { limitMicro?: number } = {},
): Promise<EffectiveAgent> {
  const ownerOrgId = await installationOrgId(installationId);

  if (!ownerOrgId || actor.activeOrgId !== ownerOrgId || !actor.positions.includes('president')) {
    await audit('authz.denied', {
      actorUserId: actor.userId,
      actingOrgId: actor.activeOrgId,
      ...(ownerOrgId ? { installationId } : {}),
      targetType: 'installation',
      targetId: installationId,
      details: { action: 'agent.publish_public' },
    });
    throw new AppError({
      code: 'forbidden',
      message: 'Only the club president can publish agents to all students.',
    });
  }

  const agent = await effectiveAgent(installationId);

  const clamped = await clampProposedChange(installationId, PUBLIC_OVERRIDE);
  if (!clamped) throw new AppError({ code: 'not_found', message: 'This agent does not exist.' });

  if (!clamped.ok) {
    const { field, allowed, message } = clamped.violation;
    await audit('installation.rejected', {
      actorUserId: actor.userId,
      actingOrgId: agent.orgId,
      installationId,
      targetType: 'installation',
      targetId: installationId,
      details: { field, allowed },
    });
    throw new AppError({
      code: 'clamp_violation',
      message,
      cap: { scope: 'installation', field, allowed },
    });
  }

  // A club with no limit row of its own reads as 0 here, and every run of its agents would be
  // blocked at the club level. §13 has provisionOrg create the club's default quota for a club the
  // roster brings in; until it has, refuse rather than write a 0 installation limit.
  const club = await remaining({ scope: 'org', orgId: agent.orgId });
  if (club.limitMicro <= 0) {
    throw new AppError({
      code: 'invalid',
      message: 'This club has no monthly AI quota yet, so its agents cannot run. Ask USG to set one first.',
    });
  }

  // The limit the installation ends up with must be above 0: a public agent with a zero budget
  // would be published and then block every run. An own limit of 0 counts as absent, so the
  // default applies.
  const zeroBudget = () =>
    new AppError({
      code: 'invalid',
      message: `${agent.name} would get a monthly budget of $0 and could not run. Choose a larger budget.`,
    });

  let limitMicro: number | null = input.limitMicro ?? null;
  if (limitMicro !== null) {
    if (!Number.isSafeInteger(limitMicro) || limitMicro < 0) {
      throw new AppError({
        code: 'invalid',
        message: 'A limit must be a whole number of micro-dollars, zero or more.',
      });
    }
    if (limitMicro === 0) throw zeroBudget();
    if (limitMicro > club.limitMicro) {
      throw new AppError({
        code: 'clamp_violation',
        message: "An agent's budget cannot exceed the club's monthly quota.",
        cap: { scope: 'org', limitMicro: club.limitMicro, field: 'limitMicro', allowed: club.limitMicro },
      });
    }
  } else if (((await ownInstallationLimit(installationId)) ?? 0) === 0) {
    limitMicro = Math.floor(club.limitMicro / 2);
    if (limitMicro === 0) throw zeroBudget();
  }

  if (limitMicro !== null) {
    await setLimit(actor, { scope: 'installation', orgId: agent.orgId, installationId, limitMicro });
  }

  await getDb()
    .update(agentInstallations)
    .set({ audience: PUBLIC_OVERRIDE.audience, usableBy: [], enabled: true })
    .where(eq(agentInstallations.id, installationId));

  // Re-read so the caller gets the clamped result, not what we hoped we wrote.
  const published = await effectiveAgent(installationId);
  const limit = await remaining({ scope: 'installation', orgId: agent.orgId, installationId });

  await audit('agent.publish_public', {
    actorUserId: actor.userId,
    actingOrgId: agent.orgId,
    installationId,
    targetType: 'installation',
    targetId: installationId,
    details: { templateSlug: published.templateSlug, maxTier: published.maxTier, limitMicro: limit.limitMicro },
  });

  return published;
}
