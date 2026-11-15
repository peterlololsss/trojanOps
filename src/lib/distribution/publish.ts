// Owner: B (WP-5, real by H7). "Publish to all students" — demo beat D3, and the one §8 marks
// never cut: it is what a club can do here that a per-person AI account cannot.
import { eq } from 'drizzle-orm';
import { AppError, type Actor, type EffectiveAgent } from '../contracts';
import { getDb } from '../db/client';
import { agentInstallations, usgClubPolicy } from '../db/schema';
import { audit } from '../gateway/audit';
import { effectiveAgent } from './effective-config';

/**
 * Sets the installation's audience to public and enables it (§8).
 *
 * The max tier is not written here: it is derived, and `clamps.ts` forces a public audience down
 * to the public tier (I4). That is what keeps the club's minutes and budget out of an agent the
 * whole campus can now open.
 *
 * TODO(WP-7): §8 also wants an installation limit, defaulting to half the club's monthly quota,
 * so an outside student cannot drain the club's budget (decision 7). The limit lives in A's
 * quota_limits, which WP-4 seeds; `input.limitMicro` is accepted and ignored until then.
 */
export async function publishToAllStudents(
  actor: Actor,
  installationId: string,
  input: { limitMicro?: number } = {},
): Promise<EffectiveAgent> {
  void input;
  const db = getDb();
  const agent = await effectiveAgent(installationId);

  if (actor.activeOrgId !== agent.orgId || !actor.positions.includes('president')) {
    throw new AppError({
      code: 'forbidden',
      message: 'Only the club president can publish agents to all students.',
    });
  }

  const [policy] = await db
    .select({ allowPublicAgents: usgClubPolicy.allowPublicAgents })
    .from(usgClubPolicy)
    .where(eq(usgClubPolicy.orgId, agent.orgId));

  if (!policy?.allowPublicAgents) {
    await audit('installation.rejected', {
      actorUserId: actor.userId,
      actingOrgId: agent.orgId,
      installationId,
      targetType: 'installation',
      targetId: installationId,
      details: { field: 'audience', allowed: ['members', 'positions'] },
    });
    throw new AppError({
      code: 'clamp_violation',
      message: 'USG has turned off public agents for this club.',
      cap: { scope: 'installation', field: 'audience', allowed: ['members', 'positions'] },
    });
  }

  await db
    .update(agentInstallations)
    .set({ audience: 'public', usableBy: [], enabled: true })
    .where(eq(agentInstallations.id, installationId));

  // Re-read so the caller gets the clamped result, not what we hoped we wrote.
  const published = await effectiveAgent(installationId);

  await audit('agent.publish_public', {
    actorUserId: actor.userId,
    actingOrgId: agent.orgId,
    installationId,
    targetType: 'installation',
    targetId: installationId,
    details: { templateSlug: published.templateSlug, maxTier: published.maxTier },
  });

  return published;
}
