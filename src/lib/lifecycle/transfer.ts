// Owner: B. D7: a manual succession changes membership history, never the imported roster baseline.
import { and, eq, isNull } from 'drizzle-orm';
import { requireUser } from '../api';
import { isUuid } from '../authz';
import { now } from '../clock';
import { AppError, type Actor } from '../contracts';
import { getDb } from '../db/client';
import { memberships, orgs, positions } from '../db/schema';
import { audit } from '../gateway/audit';

/** End the old office and start the new one in ONE transaction. Leaving roster_state untouched
 * means a later import of identical roster rows must not replace this manual assignment (§13).
 * D's importer must compare its incoming roster with roster_state, not current memberships.
 */
export async function transferPosition(actor: Actor, orgId: string, positionSlug: string, toUserId: string): Promise<void> {
  const userId = requireUser(actor);
  const forbidden = () => new AppError({ code: 'forbidden', message: 'Only the president acting in this club can transfer a position.' });
  const missing = (message: string) => new AppError({ code: 'not_found', message });
  let result: { positionId: string; fromUserIds: string[]; changed: boolean };
  try {
    if (actor.activeOrgId !== orgId || !actor.positions.includes('president')) throw forbidden();
    if (!isUuid(orgId)) throw missing('This active club does not exist.');
    result = await getDb().transaction(async tx => {
      // Serialize transfers within a club, including transfer of its president. Non-key locks
      // still permit foreign-key checks by other services; no membership unique key is needed.
      const [club] = await tx.select().from(orgs).where(eq(orgs.id, orgId)).for('no key update');
      if (club?.kind !== 'rso' || club.status !== 'active') throw missing('This active club does not exist.');
      // Re-read authority after taking the lock: an Actor captured before a presidential handoff
      // must not retain permission to assign another office afterwards.
      const [president] = await tx.select({ id: memberships.id }).from(memberships)
        .innerJoin(positions, and(eq(positions.id, memberships.positionId), eq(positions.orgId, memberships.orgId)))
        .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId),
          isNull(memberships.endedAt), eq(positions.slug, 'president'))).limit(1);
      if (!president) throw forbidden();
      const [position] = await tx.select().from(positions)
        .where(and(eq(positions.orgId, orgId), eq(positions.slug, positionSlug)));
      if (!position) throw missing('This position does not exist in this club.');
      // TODO(verify): succession manages single-holder officer positions; replacing the shared
      // Member position would silently remove the whole club. Bulk membership editing is separate.
      if (!position.isOfficer) throw new AppError({ code: 'invalid', message: 'Transfer an officer position, not the shared member position.' });
      if (!isUuid(toUserId)) throw missing('Choose a current member of this club.');
      const [recipient] = await tx.select({ id: memberships.id }).from(memberships)
        .innerJoin(positions, and(eq(positions.id, memberships.positionId), eq(positions.orgId, memberships.orgId)))
        .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, toUserId), isNull(memberships.endedAt))).limit(1);
      if (!recipient) throw missing('Choose a current member of this club.');
      const holders = await tx.select().from(memberships).where(and(
        eq(memberships.orgId, orgId), eq(memberships.positionId, position.id), isNull(memberships.endedAt)));
      const fromUserIds = [...new Set(holders.map(m => m.userId))].sort();
      if (fromUserIds.length > 1) throw new AppError({ code: 'invalid', message: 'This office has multiple holders. Resolve its membership records before transferring it.' });
      if (holders.length === 1 && holders[0].userId === toUserId) {
        return { positionId: position.id, fromUserIds, changed: false };
      }
      const at = now();
      await tx.update(memberships).set({ endedAt: at }).where(and(
        eq(memberships.orgId, orgId), eq(memberships.positionId, position.id), isNull(memberships.endedAt)));
      await tx.insert(memberships).values({ orgId, userId: toUserId, positionId: position.id,
        source: 'manual', startedAt: at, createdAt: at });
      return { positionId: position.id, fromUserIds, changed: true };
    });
  } catch (err) {
    if (err instanceof AppError && err.error.code === 'forbidden') {
      await audit('authz.denied', { actorUserId: userId, actingOrgId: actor.activeOrgId,
        targetType: 'org', targetId: orgId, details: { action: 'position.transfer' } });
    }
    throw err;
  }
  // The shared audit writer owns its connection. Write only after the membership transaction
  // succeeds; an insertion failure above must neither end the old tenure nor claim a transfer.
  await audit('position.transfer', { actorUserId: userId, actingOrgId: orgId,
    targetType: 'position', targetId: result.positionId,
    details: { fromUserIds: result.fromUserIds, toUserId, changed: result.changed } });
}
