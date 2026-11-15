// Owner: B (WP-5, real by H7). "Publish to all students" — demo beat D3, and the one §8 marks
// never cut: it is what a club can do here that a per-person AI account cannot.
import { eq } from 'drizzle-orm';
import { AppError, type Actor, type EffectiveAgent } from '../contracts';
import { getDb } from '../db/client';
import { agentInstallations } from '../db/schema';
import { audit } from '../gateway/audit';
import { remaining, setLimit } from '../gateway/quota';
import { effectiveAgent } from './effective-config';
import { clampProposedChange } from './queries';

/** What a published installation overrides. Its max tier is derived, not written: I4 forces a
 * public audience down to the public tier, and that is what keeps the club's minutes and budget
 * out of an agent the whole campus can now open. */
const PUBLIC_OVERRIDE: { audience: 'public'; usableBy: string[] } = { audience: 'public', usableBy: [] };

/**
 * Sets the installation's audience to public and enables it (§8).
 *
 * The clamps run **before** the write. A version published only to members cannot be widened to
 * the campus (I7), and writing first would leave a row that no later read can clamp — which would
 * throw out of `directory()` and `myAgents()` for every student, not just this club.
 *
 * §8 also requires an installation limit, defaulting to half the club's monthly quota, so an
 * outside student cannot drain the club's budget (decision 7). It is set *before* the row changes:
 * if the limit is refused, nothing has been published.
 */
export async function publishToAllStudents(
  actor: Actor,
  installationId: string,
  input: { limitMicro?: number } = {},
): Promise<EffectiveAgent> {
  const agent = await effectiveAgent(installationId);

  if (actor.activeOrgId !== agent.orgId || !actor.positions.includes('president')) {
    await audit('authz.denied', {
      actorUserId: actor.userId,
      actingOrgId: actor.activeOrgId,
      installationId,
      targetType: 'installation',
      targetId: installationId,
      details: { action: 'agent.publish_public' },
    });
    throw new AppError({
      code: 'forbidden',
      message: 'Only the club president can publish agents to all students.',
    });
  }

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

  // A club with no limit row of its own yields 0 here, which would block the agent on every run.
  // That is why §13 has provisionOrg create the club's default quota for a club the roster brings
  // in; without it a newly provisioned club can publish an agent nobody can use.
  const club = await remaining({ scope: 'org', orgId: agent.orgId });
  const limitMicro = input.limitMicro ?? Math.floor(club.limitMicro / 2);

  await setLimit(actor, { scope: 'installation', orgId: agent.orgId, installationId, limitMicro });

  await getDb()
    .update(agentInstallations)
    .set({ audience: PUBLIC_OVERRIDE.audience, usableBy: [], enabled: true })
    .where(eq(agentInstallations.id, installationId));

  // Re-read so the caller gets the clamped result, not what we hoped we wrote.
  const published = await effectiveAgent(installationId);

  await audit('agent.publish_public', {
    actorUserId: actor.userId,
    actingOrgId: agent.orgId,
    installationId,
    targetType: 'installation',
    targetId: installationId,
    details: { templateSlug: published.templateSlug, maxTier: published.maxTier, limitMicro },
  });

  return published;
}
