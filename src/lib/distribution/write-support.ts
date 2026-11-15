// Owner: B. Shared write checks; all installation candidates use the same pure I7 clamps.
import { and, desc, eq, sql } from 'drizzle-orm';
import { requireUser } from '../api';
import { isUuid, isUsgAdmin } from '../authz';
import { now } from '../clock';
import { AppError, type Actor, type AuditAction, type AuditEvent } from '../contracts';
import { getDb, type Tx } from '../db/client';
import { agentInstallations, agentTemplates, agentTemplateVersions, orgs, positions, quotaLimits, sources, usgClubPolicy } from '../db/schema';
import { audit } from '../gateway/audit';
import { clampInstallation, type ClampInput } from './clamps';

export const invalid = (message: string) => new AppError({ code: 'invalid', message });
export const missing = () => new AppError({ code: 'not_found', message: 'This template or installation does not exist.' });
export type Template = typeof agentTemplates.$inferSelect;
export type Installation = typeof agentInstallations.$inferSelect;
export type Version = typeof agentTemplateVersions.$inferSelect;
export const event = (actor: Actor, targetType: string, targetId: string): AuditEvent => ({
  actorUserId: actor.userId, actingOrgId: actor.activeOrgId, targetType, targetId, details: {},
});

/** Audit errors outside the failed write transaction, so the refusal is retained. */
export async function checkedWrite<T>(actor: Actor, targetType: string, targetId: string, fn: () => Promise<T>): Promise<T> {
  requireUser(actor);
  try { return await fn(); } catch (err) {
    if (err instanceof AppError && ['forbidden', 'clamp_violation'].includes(err.error.code)) {
      const e = event(actor, targetType, targetId);
      if (targetType === 'installation' && isUuid(targetId)) {
        const [found] = await getDb().select({ id: agentInstallations.id }).from(agentInstallations).where(eq(agentInstallations.id, targetId));
        if (found) e.installationId = targetId;
      }
      if (err.error.cap) e.details = { field: err.error.cap.field ?? '', allowed: err.error.cap.allowed as string | number | string[] };
      await audit(err.error.code === 'forbidden' ? 'authz.denied' : 'installation.rejected', e);
    }
    throw err;
  }
}
export function president(actor: Actor, orgId: string): void {
  if (actor.activeOrgId !== orgId || !actor.positions.includes('president')) {
    throw new AppError({ code: 'forbidden', message: 'Only the president acting in this club can change its agents.' });
  }
}
export async function usgAdmin(tx: Tx, actor: Actor): Promise<void> {
  if (!await isUsgAdmin(actor)) throw new AppError({ code: 'forbidden', message: 'Only a USG admin can perform this action.' });
}
export async function lockTemplate(tx: Tx, id: string): Promise<Template> {
  if (!isUuid(id)) throw missing();
  const [t] = await tx.select().from(agentTemplates).where(eq(agentTemplates.id, id)).for('no key update');
  if (!t) throw missing();
  return t;
}
export function active(t: Template): void { if (t.status === 'retired') throw invalid('This template is retired.'); }
export async function lockClub(tx: Tx, orgId: string, requireActive = true): Promise<void> {
  const [org] = await tx.select().from(orgs).where(eq(orgs.id, orgId)).for('no key update');
  if (!org || (requireActive && org.status !== 'active')) throw invalid('This organization is inactive.');
}
export async function versionFor(tx: Tx, template: Template, installation?: Pick<Installation, 'track' | 'pinnedVersion'>): Promise<Version> {
  const number = installation?.track === 'pinned' ? installation.pinnedVersion : template.latestVersion;
  if (number == null) throw invalid('Choose a published version when pinning this agent.');
  const [v] = await tx.select().from(agentTemplateVersions).where(and(
    eq(agentTemplateVersions.templateId, template.id), eq(agentTemplateVersions.version, number)));
  if (!v) throw missing();
  return v;
}
export async function clubBudget(tx: Tx, orgId: string): Promise<number> {
  const [q] = await tx.select().from(quotaLimits).where(and(eq(quotaLimits.scope, 'org'), eq(quotaLimits.orgId, orgId)))
    .orderBy(desc(quotaLimits.setAt), desc(quotaLimits.createdAt)).limit(1);
  return q?.limitMicro ?? 0;
}
export async function clampWrite(tx: Tx, orgId: string, version: ClampInput['version'], installation: ClampInput['installation']) {
  const [policy] = await tx.select().from(usgClubPolicy).where(eq(usgClubPolicy.orgId, orgId));
  const held = await tx.select().from(positions).where(eq(positions.orgId, orgId));
  const owned = await tx.select({ id: sources.id }).from(sources).where(eq(sources.orgId, orgId));
  const result = clampInstallation({ version, installation, club: {
    policy: policy ?? { allowedModelClasses: [], allowPublicAgents: false },
    positionSlugs: held.map(p => p.slug), ownedSourceIds: owned.map(s => s.id), quotaMicro: await clubBudget(tx, orgId),
  } });
  if (!result.ok) {
    const { field, allowed, message } = result.violation;
    throw new AppError({ code: 'clamp_violation', message, cap: { scope: 'installation', field, allowed } });
  }
  return result.effective;
}
/** Shared protocol with A's quota writer; this only serializes bootstrap inserts.
 * TODO(verify): ask A to export this lock helper so the advisory key has one definition. */
export async function lockQuotaBootstrap(tx: Tx): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('trojanops:quota'))`);
}
/** New public installations need a budget in the same transaction as their creation (§11).
 * Existing limits stay intact; interactive changes are handled by quota.setLimit, never here. */
export async function ensurePublicBudget(tx: Tx, actor: Actor, installationId: string, orgId: string) {
  await lockQuotaBootstrap(tx);
  const [limit] = await tx.select().from(quotaLimits).where(and(eq(quotaLimits.scope, 'installation'), eq(quotaLimits.installationId, installationId)));
  if (!limit) { const at = now(); await tx.insert(quotaLimits).values({ scope: 'installation', orgId, installationId,
    limitMicro: Math.floor(await clubBudget(tx, orgId) / 2), setBy: actor.userId, setAt: at, createdAt: at }); }
}
export async function audited(actor: Actor, action: AuditAction, targetType: string, targetId: string, details: AuditEvent['details'] = {}) {
  await audit(action, { ...event(actor, targetType, targetId), ...(targetType === 'installation' ? { installationId: targetId } : {}), details });
}
