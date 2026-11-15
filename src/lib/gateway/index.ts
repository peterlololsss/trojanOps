// Owner: A (WP-4: steps 1–3 and 5–8 by H9, quota by H11). Every agent run goes through runAgent (I5).
// STUB: runs §7 steps 1–3, 5, 6 and the audit rows on the other streams' stubs, but writes nothing to
// the DB and does not hold or settle quota yet.
import { randomUUID } from 'node:crypto';
import { AppError, type Actor, type ApiError, type RunResult } from '../contracts';
import { capGrants, grantLabels, grantsFor } from '../authz';
import { canUse, effectiveAgent } from '../distribution';
import { listAccessibleDocuments } from '../documents/access';
import { getRuntime } from '../runtime';
import { MOCK_COST_MICRO } from '../runtime/mock';
import { audit } from './audit';
import { remaining } from './quota';
import { ORG, SOURCE } from '@db/seed/ids';

// STUB names until WP-4 reads them from the DB.
const CLUB_NAMES: Record<string, string> = {
  [ORG.usg]: 'USG', [ORG.startup]: 'Startup Club', [ORG.archery]: 'Archery Club', [ORG.dance]: 'Dance Club',
};
const SOURCE_NAMES: Record<string, string> = Object.fromEntries(
  (Object.keys(SOURCE) as Array<keyof typeof SOURCE>).flatMap((org) =>
    Object.entries(SOURCE[org]).map(([kind, id]) => [id, `${CLUB_NAMES[ORG[org]]} · ${kind}`]),
  ),
);

export async function runAgent(actor: Actor, installationId: string, input: string): Promise<RunResult> {
  if (!actor.userId) throw new AppError({ code: 'unauthenticated', message: 'Choose a persona to run agents.' });
  const userId = actor.userId;
  const deny = async (error: ApiError, reason: string): Promise<never> => {
    await audit('authz.denied', {
      actorUserId: userId, actingOrgId: actor.activeOrgId, installationId,
      targetType: 'installation', targetId: installationId, details: { reason },
    });
    throw new AppError(error);
  };

  // 1. Effective agent. Internal agents run only with their club active; public ones from anywhere.
  const agent = await effectiveAgent(installationId);
  const club = CLUB_NAMES[agent.orgId] ?? 'this club';
  if (agent.status === 'retired') await deny({ code: 'forbidden', message: 'Retired by USG.' }, 'retired');
  if (agent.status === 'disabled') await deny({ code: 'forbidden', message: `${agent.name} is turned off in ${club}.` }, 'disabled');
  if (agent.audience !== 'public' && actor.activeOrgId !== agent.orgId) {
    await deny({ code: 'forbidden', message: `Switch to ${club} to use ${agent.name}.` }, 'inactive_org');
  }

  // 2. Audience
  const verdict = await canUse(userId, agent);
  if (!verdict.ok) await deny({ code: 'forbidden', message: `You are not in the audience for ${agent.name}.` }, 'audience');

  // 3. Grants, capped by max tier
  const runGrants = capGrants(await grantsFor(userId, agent.orgId), agent.orgId, agent.maxTier);

  // 4. Quota: TODO(WP-4) hold, block with quota.blocked before the runtime is called.

  // 5. Accessible documents
  const runId = randomUUID();
  const docs = await listAccessibleDocuments(actor, runGrants, agent);
  await audit('run.access', {
    actorUserId: userId, actingOrgId: actor.activeOrgId, runId, installationId,
    targetType: 'run', targetId: runId, details: { documentIds: docs.map((d) => d.id) },
  });

  // 6. Runtime
  const result = await getRuntime().run(agent, actor, input, { runId, accessibleDocuments: docs });

  // 7. Write tools become pending actions: TODO(WP-4)
  // 8. Settle and audit: TODO(WP-4) ai_usage settle, agent_runs update.
  const costMicro = result.usage.costMicro ?? MOCK_COST_MICRO;
  const auditEventId = await audit('agent.run', {
    actorUserId: userId, actingOrgId: actor.activeOrgId, runId, installationId,
    targetType: 'run', targetId: runId, details: { runId, costMicro },
  });

  const cited = new Set(result.citations.map((c) => c.documentId));
  const clubQuota = await remaining({ scope: 'org', orgId: agent.orgId });
  return {
    runId,
    reply: result.reply,
    citations: result.citations,
    pendingActions: [],
    inspector: {
      runGrants: await grantLabels(runGrants),
      sources: agent.sourceIds.map((id) => ({ id, name: SOURCE_NAMES[id] ?? 'Source' })),
      permitted: docs.map(({ id, title, tier }) => ({ id, title, tier })),
      readInRun: docs.filter((d) => cited.has(d.id)).map(({ id, title }) => ({ id, title })),
      templateVersion: agent.templateVersion,
      rulePack: agent.rulePack ? { label: agent.rulePack.label, version: agent.rulePack.version } : undefined,
      billedClub: club,
      costMicro,
      quotaRemainingMicro: { [club]: clubQuota.remainingMicro },
      auditEventId,
    },
  };
}

export const gateway = { runAgent };
