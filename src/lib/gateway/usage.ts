import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { requireUser } from '../api';
import { activeMemberships, grantsFor, isUsgAdmin } from '../authz';
import { now } from '../clock';
import type { Actor } from '../contracts';
import { agentInstallations, agentRuns, agentRunsMeta, agentTemplates, auditEvents, orgs } from '../db/schema';
import { withActor } from '../db/with-actor';
import { periodEnd, periodStart } from './period';
import { levelRemaining, releaseStaleHoldsIfFree } from './quota';

export async function myUsage(actor: Actor) {
  const userId = requireUser(actor);
  const memberships = await activeMemberships(userId) ?? [];
  const clubs = [...new Map(memberships.map((m) => [m.orgId, m.orgName])).entries()];
  const at = now();
  return withActor(actor, {}, async (tx) => {
    await releaseStaleHoldsIfFree(tx, at);
    const runs = await tx.select({ id: agentRuns.id, startedAt: agentRuns.startedAt, agent: agentTemplates.name,
      club: orgs.name, model: agentRuns.model, documentsRead: sql<number>`cardinality(${agentRuns.citedDocumentIds})`,
      costMicro: agentRuns.costMicro, status: agentRuns.status,
    }).from(agentRuns).innerJoin(agentInstallations, eq(agentInstallations.id, agentRuns.installationId))
      .innerJoin(agentTemplates, eq(agentTemplates.id, agentInstallations.templateId)).innerJoin(orgs, eq(orgs.id, agentRuns.billedOrgId))
      .where(gte(agentRuns.startedAt, new Date(at.getTime() - 30 * 86_400_000))).orderBy(desc(agentRuns.startedAt));
    const [total] = await tx.select({ micro: sql<number>`coalesce(sum(${agentRuns.costMicro}), 0)::bigint` }).from(agentRuns)
      .where(gte(agentRuns.startedAt, periodStart('month', at)));
    const [blocked] = await tx.select({ count: sql<number>`count(*)::int` }).from(auditEvents)
      .where(and(eq(auditEvents.actorUserId, userId), eq(auditEvents.action, 'quota.blocked'), gte(auditEvents.ts, periodStart('month', at))));
    const allowances = [];
    for (const [orgId, name] of clubs) {
      const value = await levelRemaining(tx, { scope: 'member', userId, orgId }, at);
      allowances.push({ ...value, label: `${name} · monthly`, resetsAt: periodEnd('month', at).toISOString() });
    }
    allowances.push({ ...await levelRemaining(tx, { scope: 'student_daily', userId }, at), label: 'Public agents · daily', resetsAt: periodEnd('day', at).toISOString() });
    return { runs, allowances, monthlyMicro: Number(total.micro), blockedAttempts: blocked.count };
  });
}

export async function citedCounts(actor: Actor, orgId: string): Promise<Record<string, number> | null> {
  const userId = requireUser(actor);
  if (!(await grantsFor(userId, orgId)).includes(`${orgId}:president`) && !(await isUsgAdmin(actor))) return null;
  const since = new Date(now().getTime() - 30 * 86_400_000);
  return withActor(actor, {}, async (tx) => {
    const rows = await tx.select({ ids: agentRunsMeta.citedDocumentIds }).from(agentRunsMeta)
      .where(and(eq(agentRunsMeta.orgId, orgId), eq(agentRunsMeta.status, 'completed'), gte(agentRunsMeta.startedAt, since)));
    const counts: Record<string, number> = {};
    for (const row of rows) for (const id of new Set(row.ids)) counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  });
}
