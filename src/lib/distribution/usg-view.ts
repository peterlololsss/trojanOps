// Owner: B. Serializable, read-only models for the USG distribution console.
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '../api';
import { isUsgAdmin, isUuid } from '../authz';
import { AppError, type Actor, type Audience, type ModelClass, type Tier } from '../contracts';
import { getDb } from '../db/client';
import { agentInstallations, agentTemplates, agentTemplateVersions, orgCohorts, orgs, positions, sources, usgClubPolicy } from '../db/schema';
import { listLibraryDocuments } from '../documents/library';
import { audit } from '../gateway/audit';
import { remaining } from '../gateway/quota';
import { loadAgents } from './queries';

export interface UsgTemplateRow {
  id: string; slug: string; name: string; distribution: 'required' | 'default' | 'optional';
  target: string; status: 'active' | 'retired'; latestVersion: number; distributedAt: string | null;
  installedCount: number; targetCount: number;
  /** From the latest published version; empty before the first version. */
  purpose: string;
}
export interface UsgTarget { slug: string; name: string; clubs: Array<{ id: string; name: string }> }
export interface UsgVersion {
  version: number; purpose: string; audience: Audience; usableBy: string[]; maxTier: Tier;
  sourceKinds: string[]; tools: string[]; modelClasses: ModelClass[]; defaultModelClass: ModelClass;
  systemPrompt: string; rulePackSlug: string | null; changelog: string; publishedAt: string;
}
export interface UsgTemplatesView { templates: UsgTemplateRow[]; targets: UsgTarget[] }
/** A position slug that exists in at least one club, with its display name. */
export interface UsgPositionOption { slug: string; name: string }
/** A USG-owned document the viewer can read, by the kind of source it sits in (rulebook, usg_internal). */
export interface UsgSourceDocument { id: string; kind: string; title: string; tier: Tier }
export interface UsgTemplateView {
  template: UsgTemplateRow; versions: UsgVersion[]; targets: UsgTarget[];
  positions: UsgPositionOption[]; usgDocuments: UsgSourceDocument[];
}
export interface UsgClub {
  readonly modelAgents: Array<{ readonly name: string; readonly modelClass: ModelClass; readonly allowed: ModelClass[] }>;
  id: string; name: string; status: 'active' | 'inactive'; allowedModelClasses: ModelClass[];
  allowPublicAgents: boolean; hasPolicy: boolean; limitMicro: number; spentMicro: number; remainingMicro: number;
}
export async function requireConsole(actor: Actor): Promise<void> {
  requireUser(actor);
  if (await isUsgAdmin(actor)) return;
  await audit('authz.denied', { actorUserId: actor.userId, actingOrgId: actor.activeOrgId,
    targetType: 'usg_console', targetId: actor.activeOrgId ?? 'usg', details: {} });
  throw new AppError({ code: 'forbidden', message: 'Only a USG administrator acting in USG can open this console.' });
}

async function templateData(): Promise<UsgTemplatesView> {
  const db = getDb();
  const [templates, clubs, cohorts, installations, latest] = await Promise.all([
    db.select().from(agentTemplates).where(eq(agentTemplates.scope, 'global')).orderBy(agentTemplates.name),
    db.select({ id: orgs.id, name: orgs.name, status: orgs.status }).from(orgs).where(eq(orgs.kind, 'rso')).orderBy(orgs.name),
    db.select().from(orgCohorts),
    db.select({ templateId: agentInstallations.templateId }).from(agentInstallations),
    db.select({ templateId: agentTemplateVersions.templateId, purpose: agentTemplateVersions.purpose })
      .from(agentTemplateVersions).innerJoin(agentTemplates, and(eq(agentTemplates.id, agentTemplateVersions.templateId), eq(agentTemplates.latestVersion, agentTemplateVersions.version))),
  ]);
  const active = clubs.filter(c => c.status === 'active').map(({ id, name }) => ({ id, name }));
  const targets: UsgTarget[] = [{ slug: 'all', name: 'All active clubs', clubs: active },
    ...[...new Set(cohorts.map(c => c.cohortSlug))].sort().map(slug => ({ slug, name: `${slug} cohort`,
      clubs: active.filter(c => cohorts.some(m => m.cohortSlug === slug && m.orgId === c.id)),
    }))];
  return { targets, templates: templates.map(t => ({
    id: t.id, slug: t.slug, name: t.name, distribution: t.distribution, target: t.target,
    status: t.status, latestVersion: t.latestVersion, distributedAt: t.distributedAt?.toISOString() ?? null,
    installedCount: installations.filter(i => i.templateId === t.id).length,
    targetCount: targets.find(x => x.slug === t.target)?.clubs.length ?? 0,
    purpose: latest.find(v => v.templateId === t.id)?.purpose ?? '',
  })) };
}
export async function usgTemplatesView(actor: Actor): Promise<UsgTemplatesView> {
  await requireConsole(actor);
  return templateData();
}
export async function usgTemplateView(actor: Actor, id: string): Promise<UsgTemplateView | null> {
  await requireConsole(actor);
  if (!isUuid(id)) return null;
  const data = await templateData();
  const template = data.templates.find(t => t.id === id);
  if (!template) return null;
  const [rows, positionRows, usgDocuments] = await Promise.all([
    getDb().select().from(agentTemplateVersions).where(eq(agentTemplateVersions.templateId, id)).orderBy(desc(agentTemplateVersions.version)),
    getDb().selectDistinct({ slug: positions.slug, name: positions.name }).from(positions)
      .innerJoin(orgs, eq(orgs.id, positions.orgId)).where(eq(orgs.kind, 'rso')).orderBy(positions.slug),
    usgSourceDocuments(actor),
  ]);
  const positionOptions = [...new Map(positionRows.map(p => [p.slug, p])).values()];
  return { template, targets: data.targets, positions: positionOptions, usgDocuments, versions: rows.map(v => ({
    version: v.version, purpose: v.purpose, audience: v.audience, usableBy: v.usableBy, maxTier: v.maxTier,
    sourceKinds: v.sourceKinds, tools: v.tools, modelClasses: v.modelClasses, defaultModelClass: v.defaultModelClass,
    systemPrompt: v.systemPrompt, rulePackSlug: v.rulePackSlug, changelog: v.changelog, publishedAt: v.publishedAt.toISOString(),
  })) };
}
/** USG's own rulebook and internal documents, read under the viewer's RLS in the USG library. */
async function usgSourceDocuments(actor: Actor): Promise<UsgSourceDocument[]> {
  const [usg] = await getDb().select({ id: orgs.id }).from(orgs).where(eq(orgs.kind, 'usg')).limit(1);
  if (!usg) return [];
  const [docs, kinds] = await Promise.all([
    listLibraryDocuments(actor, usg.id),
    getDb().select({ id: sources.id, kind: sources.kind }).from(sources).where(and(eq(sources.orgId, usg.id), inArray(sources.kind, ['rulebook', 'usg_internal']))),
  ]);
  return docs.flatMap(d => { const kind = kinds.find(k => k.id === d.sourceId)?.kind; return kind ? [{ id: d.id, kind, title: d.title, tier: d.tier }] : []; })
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}
export async function usgClubsView(actor: Actor): Promise<UsgClub[]> {
  await requireConsole(actor);
  const [clubs, policies] = await Promise.all([
    getDb().select().from(orgs).where(eq(orgs.kind, 'rso')).orderBy(orgs.name),
    getDb().select().from(usgClubPolicy),
  ]);
  const result: UsgClub[] = [];
  for (const c of clubs) {
    const policy = policies.find(p => p.orgId === c.id);
    const quota = await remaining({ scope: 'org', orgId: c.id });
    const modelAgents = (await loadAgents({ orgIds: [c.id], excludeRetired: true })).map(({ agent }) => ({ name: agent.name, modelClass: agent.modelClass, allowed: agent.allowedModelClasses }));
    result.push({ id: c.id, name: c.name, status: c.status, hasPolicy: !!policy, modelAgents,
      allowedModelClasses: policy?.allowedModelClasses ?? [], allowPublicAgents: policy?.allowPublicAgents ?? false,
      limitMicro: quota.limitMicro, spentMicro: quota.spentMicro, remainingMicro: quota.remainingMicro });
  }
  return result;
}
