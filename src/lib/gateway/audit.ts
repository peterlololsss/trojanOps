// Owner: A (WP-4). The only audit writer (§12). audit_events is append-only: the app role has no
// UPDATE or DELETE on it (I8). details hold ids and numbers only, never document text or run
// input/output. audit_events has no RLS, so it is read and written with getDb() or the caller's tx.
import { and, desc, eq, inArray, or, type SQL } from 'drizzle-orm';
import { AppError, type Actor, type AuditAction, type AuditEntry, type AuditEvent } from '../contracts';
import { now } from '../clock';
import { getDb, type Tx } from '../db/client';
import { isUsgAdmin } from '../authz';
import { agentInstallations, auditEvents } from '../db/schema';

/** Writes one audit row and returns its id. Pass `tx` to write it in the caller's transaction, so the
 * change and its audit row commit or roll back together. */
export async function audit(action: AuditAction, event: AuditEvent, tx?: Tx): Promise<number> {
  const [row] = await (tx ?? getDb())
    .insert(auditEvents)
    .values({
      ts: now(),
      actorUserId: event.actorUserId,
      actingOrgId: event.actingOrgId,
      action,
      runId: event.runId ?? null,
      installationId: event.installationId ?? null,
      targetType: event.targetType,
      targetId: event.targetId,
      details: event.details,
    })
    .returning({ id: auditEvents.id });
  return row.id;
}

/** Rows that concern a club: acted in it, about one of its installations (a public-agent run by an
 * outside student is billed to, and shown to, the publishing club), or targeting the club itself
 * (e.g. USG setting its quota). TODO(verify): the acting club also sees its members' runs of other
 * clubs' public agents; §12 doesn't say either way. */
function concernsOrg(orgId: string): SQL {
  const installations = getDb().select({ id: agentInstallations.id }).from(agentInstallations)
    .where(eq(agentInstallations.orgId, orgId));
  return or(
    eq(auditEvents.actingOrgId, orgId),
    inArray(auditEvents.installationId, installations),
    and(eq(auditEvents.targetType, 'org'), eq(auditEvents.targetId, orgId)),
  )!;
}

/** The org whose audit rows the viewer may read: 'all' for a USG admin acting in USG, their club for
 * a president acting in it, null for everyone else. */
async function auditScope(viewer: Actor): Promise<'all' | string | null> {
  if (!viewer.userId || !viewer.activeOrgId) return null;
  if (await isUsgAdmin(viewer)) return 'all';
  return viewer.positions.includes('president') ? viewer.activeOrgId : null;
}

/** Audit rows the viewer may see, newest first: USG admins all, presidents their club (§12).
 * Anyone else, or a president asking for another club, gets 403 forbidden. */
export async function listAudit(
  viewer: Actor,
  filter: { orgId?: string; action?: AuditAction; limit?: number } = {},
): Promise<AuditEntry[]> {
  const scope = await auditScope(viewer);
  if (!scope) throw new AppError({ code: 'forbidden', message: 'Only club presidents and USG admins can read the audit log.' });
  if (scope !== 'all' && filter.orgId && filter.orgId !== scope) {
    throw new AppError({ code: 'forbidden', message: "You can read only your club's audit log." });
  }

  const conditions: SQL[] = [];
  const orgId = scope === 'all' ? filter.orgId : scope;
  if (orgId) conditions.push(concernsOrg(orgId));
  if (filter.action) conditions.push(eq(auditEvents.action, filter.action));

  const rows = await getDb()
    .select()
    .from(auditEvents)
    .where(and(...conditions))
    .orderBy(desc(auditEvents.id))
    .limit(Math.min(Math.max(filter.limit ?? 100, 1), 1000));

  return rows.map((r) => ({
    id: r.id,
    ts: r.ts,
    action: r.action,
    actorUserId: r.actorUserId,
    actingOrgId: r.actingOrgId,
    ...(r.runId ? { runId: r.runId } : {}),
    ...(r.installationId ? { installationId: r.installationId } : {}),
    targetType: r.targetType,
    targetId: r.targetId,
    details: r.details as AuditEvent['details'],
  }));
}
