// Owner: A (WP-4). gateway.confirm and gateway.reject: a human decides a pending write action (I6,
// §14). The run's own user decides, holding an active membership in the action's club, and a position
// that may confirm that tool when the tool names any. Nothing executes here: no write tool has an
// executor yet, so this records the decision. confirmed_by and confirmed_at record who decided, either way.
// TODO(WP-14): before executing a write tool, re-run effectiveAgent and canUse at confirm time: the
// agent may have been disabled, retired or restricted since the run.
// TODO(verify): a non-member who ran a public agent cannot confirm its pending actions (the club
// membership check). Confirm with the team whether such actions need another confirmer.
import { and, eq } from 'drizzle-orm';
import { AppError, type Actor } from '../contracts';
import { activeMemberships, isUuid } from '../authz';
import { now } from '../clock';
import { getDb } from '../db/client';
import { agentRunsMeta, pendingActions } from '../db/schema';
import { audit } from './audit';
import { confirmerPositions } from './tools';

type Decision = 'confirmed' | 'rejected';
const VERB: Record<Decision, string> = { confirmed: 'confirm', rejected: 'reject' };

export function confirm(actor: Actor, pendingActionId: string): Promise<{ id: string; tool: string; status: 'confirmed' }> {
  return decide(actor, pendingActionId, 'confirmed');
}

/** Rejects a pending action: the same people who may confirm it may reject it. */
export function reject(actor: Actor, pendingActionId: string): Promise<{ id: string; tool: string; status: 'rejected' }> {
  return decide(actor, pendingActionId, 'rejected');
}

async function decide<D extends Decision>(actor: Actor, pendingActionId: string, decision: D): Promise<{ id: string; tool: string; status: D }> {
  const verb = VERB[decision];
  if (!actor.userId) throw new AppError({ code: 'unauthenticated', message: `Choose a persona to ${verb} actions.` });
  const userId = actor.userId;
  const notFound = new AppError({ code: 'not_found', message: 'This action does not exist.' });
  if (!isUuid(pendingActionId)) throw notFound;

  const db = getDb();
  const [action] = await db.select().from(pendingActions).where(eq(pendingActions.id, pendingActionId));
  if (!action) throw notFound;
  const [run] = await db.select({ installationId: agentRunsMeta.installationId }).from(agentRunsMeta)
    .where(eq(agentRunsMeta.id, action.runId));
  const event = {
    actorUserId: userId,
    actingOrgId: actor.activeOrgId,
    ...(run ? { installationId: run.installationId } : {}),
    runId: action.runId,
    targetType: 'pending_action',
    targetId: action.id,
  };

  // The run page is private to the user who ran it (I15); positions are recomputed from the DB (I3).
  const allowed = confirmerPositions(action.tool);
  const held = (await activeMemberships(userId)) ?? [];
  const mayConfirm = action.userId === userId
    && held.some((m) => m.orgId === action.orgId && (allowed === null || allowed.includes(m.positionSlug)));
  if (!mayConfirm) {
    await audit('authz.denied', { ...event, details: { reason: `${verb}_forbidden`, pendingActionId: action.id, tool: action.tool } });
    throw new AppError({ code: 'forbidden', message: `You cannot ${verb} this action.` });
  }

  // The decision and its audit row commit together.
  const at = now();
  await db.transaction(async (tx) => {
    const [done] = await tx.update(pendingActions)
      .set({ status: decision, confirmedBy: userId, confirmedAt: at })
      .where(and(eq(pendingActions.id, action.id), eq(pendingActions.status, 'pending')))
      .returning({ id: pendingActions.id });
    if (!done) throw new AppError({ code: 'invalid', message: `This action was already ${action.status === 'pending' ? 'handled' : action.status}.` });
    await audit(decision === 'confirmed' ? 'tool.confirm' : 'tool.reject', { ...event, details: { pendingActionId: action.id, tool: action.tool } }, tx);
  });
  return { id: action.id, tool: action.tool, status: decision };
}
