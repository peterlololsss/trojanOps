// Owner: A (WP-4). Every agent run goes through runAgent (I5): §7 steps 1–3 and 5–8 on the DB.
// Step 4 (quota) holds the estimated cost in ./quota before the run row exists, and settles it in step 8.
//
// DB calls run one after another, never nested or in parallel: each withActor is its own
// transaction on its own pooled connection, and tests/db.ts runs them as savepoints of one.
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { AppError, type AccessibleDocument, type Actor, type AgentResult, type ApiError, type EffectiveAgent, type RunResult } from '../contracts';
import { capGrants, grantLabels, grantsFor } from '../authz';
import { now } from '../clock';
import { getDb } from '../db/client';
import { agentRuns, orgs, pendingActions, sources } from '../db/schema';
import { withActor } from '../db/with-actor';
import { canUse, effectiveAgent } from '../distribution';
import { listAccessibleDocuments } from '../documents/access';
import { getRuntime } from '../runtime';
import { audit } from './audit';
import { headroom, hold, settle, type QuotaHold } from './quota';
import { confirm } from './confirm';
import { toolKind } from './tools';

async function orgName(orgId: string): Promise<string> {
  const [org] = await getDb().select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId));
  return org?.name ?? 'this club';
}

async function sourceNames(ids: string[]): Promise<Array<{ id: string; name: string }>> {
  const rows = ids.length
    ? await getDb().select({ id: sources.id, name: sources.name }).from(sources).where(inArray(sources.id, ids))
    : [];
  const names = new Map(rows.map((r) => [r.id, r.name]));
  return ids.map((id) => ({ id, name: names.get(id) ?? 'Source' }));
}

export async function runAgent(actor: Actor, installationId: string, input: string): Promise<RunResult> {
  if (!actor.userId) throw new AppError({ code: 'unauthenticated', message: 'Choose a persona to run agents.' });
  const userId = actor.userId;
  const event = { actorUserId: userId, actingOrgId: actor.activeOrgId, installationId };
  const deny = async (error: ApiError, reason: string): Promise<never> => {
    await audit('authz.denied', { ...event, targetType: 'installation', targetId: installationId, details: { reason } });
    throw new AppError(error);
  };

  // 1. Effective agent. Internal agents run only with their club active; public ones from anywhere.
  const agent = await effectiveAgent(installationId);
  const club = await orgName(agent.orgId);
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

  // 4. Quota hold (blocks with quota_exceeded before the runtime), then the run row. The id is generated here: RETURNING would
  // need SELECT on the new row under RLS (§5). From here on, any failure marks the run failed and
  // releases the hold.
  const runId = randomUUID();
  const held = await hold(agent, userId, actor.activeOrgId, runId, club);
  const runEvent = { ...event, runId, targetType: 'run', targetId: runId };
  const done = { inserted: false, completed: false, settled: false };
  let docs: AccessibleDocument[];
  let result: AgentResult;
  let pending: RunResult['pendingActions'];
  let citations: AgentResult['citations'];
  let cited: string[];
  let costMicro: number;
  let auditEventId: number;
  try {
    await withActor(actor, {}, (tx) => tx.insert(agentRuns).values({
      id: runId,
      installationId,
      templateVersion: agent.templateVersion,
      rulePackVersion: agent.rulePack?.version ?? null,
      orgId: agent.orgId,
      billedOrgId: agent.orgId,
      userId,
      input,
      status: 'running',
      startedAt: now(),
      createdAt: now(),
    }));
    done.inserted = true;

    // 5. Accessible documents
    docs = await listAccessibleDocuments(actor, runGrants, agent);
    await audit('run.access', { ...runEvent, details: { documentIds: docs.map((d) => d.id) } });

    // 6. Runtime
    result = await getRuntime().run(agent, actor, input, { runId, accessibleDocuments: docs });
    costMicro = result.usage.costMicro ?? held.holdMicro;
    if (!Number.isSafeInteger(costMicro) || costMicro < 0) {
      throw new Error('The runtime reported a cost that is not a whole number of micro-dollars, zero or more.');
    }

    // 7. Proposed actions: tools outside the agent's list are refused; write tools wait for a human (I6).
    pending = await queueActions(agent, userId, runEvent, result.proposedActions);

    // 8. Record the run, settle, audit. Citations must name a document the run could read.
    const accessible = new Set(docs.map((d) => d.id));
    citations = result.citations.filter((c) => accessible.has(c.documentId));
    cited = [...new Set(citations.map((c) => c.documentId))];
    const { reply, usage } = result;
    await withActor(actor, {}, (tx) => tx.update(agentRuns)
      .set({
        output: { reply, citations },
        accessibleDocumentIds: docs.map((d) => d.id),
        citedDocumentIds: cited,
        model: usage.model,
        costMicro,
        status: 'completed',
        finishedAt: now(),
      })
      .where(eq(agentRuns.id, runId)));
    done.completed = true;
    await settle(held, costMicro, usage.model);
    done.settled = true;
    auditEventId = await audit('agent.run', { ...runEvent, details: { runId, costMicro } });
  } catch (err) {
    await failRun(actor, runId, done, held).catch(() => {}); // keep the original error
    throw err;
  }

  const quotaLeft = await headroom(agent, userId);
  return {
    runId,
    reply: result.reply,
    citations,
    pendingActions: pending,
    inspector: {
      runGrants: await grantLabels(runGrants),
      sources: await sourceNames(agent.sourceIds),
      permitted: docs.map(({ id, title, tier }) => ({ id, title, tier })),
      readInRun: docs.filter((d) => cited.includes(d.id)).map(({ id, title }) => ({ id, title })),
      // blocked: TODO(WP-4) needs a documents/access helper from C for documents the run can't read.
      templateVersion: agent.templateVersion,
      rulePack: agent.rulePack ? { label: agent.rulePack.label, version: agent.rulePack.version } : undefined,
      billedClub: club,
      costMicro,
      quotaRemainingMicro: { [club]: quotaLeft }, // the smallest remaining over the levels that apply to this run
      auditEventId,
    },
  };
}

/** Marks a run failed (when its row exists and isn't completed) and releases its hold (unless it is
 * already settled), so a failure late in step 8 neither rewrites a completed run nor settles twice. */
async function failRun(
  actor: Actor, runId: string, done: { inserted: boolean; completed: boolean; settled: boolean }, held: QuotaHold,
): Promise<void> {
  if (done.inserted && !done.completed) {
    await withActor(actor, {}, (tx) => tx.update(agentRuns)
      .set({ status: 'failed', finishedAt: now() })
      .where(eq(agentRuns.id, runId)));
  }
  if (!done.settled) await settle(held, 0);
}

// A proposed tool name is model output; only a plain identifier is recorded in audit (I8).
const TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;

/** §7 step 7. Write tools become pending_actions with a tool.call row each; a tool the agent doesn't
 * have is dropped with authz.denied. Read and draft tools run through gateway.tool() once real agents
 * exist (WP-14); none are registered yet. */
async function queueActions(
  agent: EffectiveAgent,
  userId: string,
  runEvent: { actorUserId: string; actingOrgId: string | null; installationId: string; runId: string; targetType: string; targetId: string },
  proposed: AgentResult['proposedActions'],
): Promise<RunResult['pendingActions']> {
  const queued: RunResult['pendingActions'] = [];
  for (const action of proposed) {
    if (!agent.tools.includes(action.tool)) {
      await audit('authz.denied', { ...runEvent, details: { reason: 'tool_not_allowed', tool: TOOL_NAME.test(action.tool) ? action.tool : 'invalid' } });
      continue;
    }
    if (toolKind(action.tool) !== 'write') continue; // TODO(WP-14): gateway.tool()
    const id = randomUUID();
    await getDb().insert(pendingActions).values({
      id,
      runId: runEvent.runId,
      orgId: agent.orgId,
      userId,
      tool: action.tool,
      args: action.args ?? {},
      status: 'pending',
      createdAt: now(),
    });
    await audit('tool.call', {
      ...runEvent, targetType: 'pending_action', targetId: id, details: { pendingActionId: id, tool: action.tool },
    });
    queued.push({ id, tool: action.tool });
  }
  return queued;
}

export const gateway = { runAgent, confirm };
