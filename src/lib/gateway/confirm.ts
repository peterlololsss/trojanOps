// Owner: A (WP-4). gateway.confirm: a human confirms a pending write action (I6, §14). The run's own
// user confirms, holding an active membership in the action's club, and a position that may confirm
// that tool when the tool names any. Nothing executes here: no write tool has an executor yet (TODO(WP-14)), so this records the decision.
import { and, eq } from 'drizzle-orm';
import { AppError, type Actor } from '../contracts';
import { activeMemberships, isUuid } from '../authz';
import { now } from '../clock';
import { getDb } from '../db/client';
import { agentRunsMeta, pendingActions } from '../db/schema';
import { audit } from './audit';
import { confirmerPositions } from './tools';

export async function confirm(actor: Actor, pendingActionId: string): Promise<{ id: string; tool: string; status: 'confirmed' }> {
  if (!actor.userId) throw new AppError({ code: 'unauthenticated', message: 'Choose a persona to confirm actions.' });
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
    await audit('authz.denied', { ...event, details: { reason: 'confirm_forbidden', pendingActionId: action.id, tool: action.tool } });
    throw new AppError({ code: 'forbidden', message: 'You cannot confirm this action.' });
  }

  const at = now();
  const [done] = await db.update(pendingActions)
    .set({ status: 'confirmed', confirmedBy: userId, confirmedAt: at })
    .where(and(eq(pendingActions.id, action.id), eq(pendingActions.status, 'pending')))
    .returning({ id: pendingActions.id });
  if (!done) throw new AppError({ code: 'invalid', message: `This action was already ${action.status === 'pending' ? 'handled' : action.status}.` });

  await audit('tool.confirm', { ...event, details: { pendingActionId: action.id, tool: action.tool } });
  return { id: action.id, tool: action.tool, status: 'confirmed' };
}
