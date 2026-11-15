// Owner: B. Serializable, read-only models for the USG distribution console.
import { and, desc, eq, inArray } from 'drizzle-orm';
import { requireUser } from '../api';
import { isUsgAdmin, isUuid } from '../authz';
import { AppError, type Actor, type Audience, type ModelClass, type Tier } from '../contracts';
import { getDb } from '../db/client';
import { agentInstallations, agentTemplates, agentTemplateVersions, orgCohorts, orgs, positions, rulePacks, sources, usgClubPolicy } from '../db/schema';
import { listLibraryDocuments } from '../documents/library';
import { parseRulePackContent } from './rule-pack-content';
import { audit } from '../gateway/audit';
import { remaining } from '../gateway/quota';

export interface UsgTemplateRow {
  id: string; slug: string; name: string; distribution: 'required' | 'default' | 'optional';
  target: string; status: 'active' | 'retired'; latestVersion: number; distributedAt: string | null;
  installedCount: number; targetCount: number;
  /** From the latest published version; empty before the first version. */
  purpose: string; rulePackSlug: string | null;
}
export interface UsgTarget { slug: string; name: string; clubs: Array<{ id: string; name: string }> }
export interface UsgVersion {
  version: number; purpose: string; audience: Audience; usableBy: string[]; maxTier: Tier;
  sourceKinds: string[]; tools: string[]; modelClasses: ModelClass[]; defaultModelClass: ModelClass;
  systemPrompt: string; rulePackSlug: string | null; changelog: string; publishedAt: string;
}
export interface UsgTemplatesView { templates: UsgTemplateRow[]; targets: UsgTarget[]; rulePacks: UsgPackOption[] }
/** A published rule pack the version editor can attach, with its latest label and rule count. */
export interface UsgPackOption { slug: string; label: string; version: number; ruleCount: number }
/** A position slug that exists in at least one club, with its display name. */
export interface UsgPositionOption { slug: string; name: string }
/** A USG-owned document the viewer can read, by the kind of source it sits in (rulebook, usg_internal). */
export interface UsgSourceDocument { kind: string; title: string; tier: Tier }
export interface UsgTemplateView {
  template: UsgTemplateRow; versions: UsgVersion[]; targets: UsgTarget[];
  rulePacks: UsgPackOption[]; positions: UsgPositionOption[]; usgDocuments: UsgSourceDocument[];
}
export interface UsgClub {
  id: string; name: string; status: 'active' | 'inactive'; allowedModelClasses: ModelClass[];
  allowPublicAgents: boolean; hasPolicy: boolean; limitMicro: number; spentMicro: number; remainingMicro: number;
}
export interface UsgPackVersion { version: number; status: 'draft' | 'published'; label: string; content: Record<string, unknown>; publishedAt: string | null }
/**
 * A template that runs with the pack: its latest version names it, or an enabled installation's
 * effective version (pinned, else latest) does. `installedCount` counts the clubs with such an
 * installation. Only `global` templates have a page in the USG console.
 */
export interface UsgPackUser {
  templateId: string; name: string; version: number; audience: Audience; usableBy: string[]; installedCount: number; global: boolean;
}
export interface UsgPack { slug: string; versions: UsgPackVersion[]; usedBy: UsgPackUser[] }

async function requireConsole(actor: Actor): Promise<void> {
  requireUser(actor);
  if (await isUsgAdmin(actor)) return;
  await audit('authz.denied', { actorUserId: actor.userId, actingOrgId: actor.activeOrgId,
    targetType: 'usg_console', targetId: actor.activeOrgId ?? 'usg', details: {} });
  throw new AppError({ code: 'forbidden', message: 'Only a USG administrator acting in USG can open this console.' });
}

async function templateData(): Promise<Omit<UsgTemplatesView, 'rulePacks'>> {
  const db = getDb();
  const [templates, clubs, cohorts, installations, latest] = await Promise.all([
    db.select().from(agentTemplates).where(eq(agentTemplates.scope, 'global')).orderBy(agentTemplates.name),
    db.select({ id: orgs.id, name: orgs.name, status: orgs.status }).from(orgs).where(eq(orgs.kind, 'rso')).orderBy(orgs.name),
    db.select().from(orgCohorts),
    db.select({ templateId: agentInstallations.templateId }).from(agentInstallations),
    db.select({ templateId: agentTemplateVersions.templateId, purpose: agentTemplateVersions.purpose, rulePackSlug: agentTemplateVersions.rulePackSlug })
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
    rulePackSlug: latest.find(v => v.templateId === t.id)?.rulePackSlug ?? null,
  })) };
}
export async function usgTemplatesView(actor: Actor): Promise<UsgTemplatesView> {
  await requireConsole(actor);
  const [data, rulePacks] = await Promise.all([templateData(), publishedPacks()]);
  return { ...data, rulePacks };
}
export async function usgTemplateView(actor: Actor, id: string): Promise<UsgTemplateView | null> {
  await requireConsole(actor);
  if (!isUuid(id)) return null;
  const data = await templateData();
  const template = data.templates.find(t => t.id === id);
  if (!template) return null;
  const [rows, packs, positionRows, usgDocuments] = await Promise.all([
    getDb().select().from(agentTemplateVersions).where(eq(agentTemplateVersions.templateId, id)).orderBy(desc(agentTemplateVersions.version)),
    publishedPacks(),
    getDb().selectDistinct({ slug: positions.slug, name: positions.name }).from(positions)
      .innerJoin(orgs, eq(orgs.id, positions.orgId)).where(eq(orgs.kind, 'rso')).orderBy(positions.slug),
    usgSourceDocuments(actor),
  ]);
  const positionOptions = [...new Map(positionRows.map(p => [p.slug, p])).values()];
  return { template, targets: data.targets, rulePacks: packs, positions: positionOptions, usgDocuments, versions: rows.map(v => ({
    version: v.version, purpose: v.purpose, audience: v.audience, usableBy: v.usableBy, maxTier: v.maxTier,
    sourceKinds: v.sourceKinds, tools: v.tools, modelClasses: v.modelClasses, defaultModelClass: v.defaultModelClass,
    systemPrompt: v.systemPrompt, rulePackSlug: v.rulePackSlug, changelog: v.changelog, publishedAt: v.publishedAt.toISOString(),
  })) };
}
/** The latest published version of every rule pack, for the version editor's picker. */
async function publishedPacks(): Promise<UsgPackOption[]> {
  const rows = await getDb().select().from(rulePacks).where(eq(rulePacks.status, 'published')).orderBy(rulePacks.slug, desc(rulePacks.version));
  const seen = new Map<string, UsgPackOption>();
  for (const r of rows) if (!seen.has(r.slug)) seen.set(r.slug, { slug: r.slug, label: r.label, version: r.version, ruleCount: ruleCount(r.content) });
  return [...seen.values()];
}
/** The rules the console can show, so the picker and the rule-pack card agree (0 for a JSON-only pack). */
export function ruleCount(content: unknown): number {
  return parseRulePackContent(content)?.rules.length ?? 0;
}
/** USG's own rulebook and internal documents, read under the viewer's RLS in the USG library. */
async function usgSourceDocuments(actor: Actor): Promise<UsgSourceDocument[]> {
  const [usg] = await getDb().select({ id: orgs.id }).from(orgs).where(eq(orgs.kind, 'usg')).limit(1);
  if (!usg) return [];
  const [docs, kinds] = await Promise.all([
    listLibraryDocuments(actor, usg.id),
    getDb().select({ id: sources.id, kind: sources.kind }).from(sources).where(and(eq(sources.orgId, usg.id), inArray(sources.kind, ['rulebook', 'usg_internal']))),
  ]);
  return docs.flatMap(d => { const kind = kinds.find(k => k.id === d.sourceId)?.kind; return kind ? [{ kind, title: d.title, tier: d.tier }] : []; })
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
    result.push({ id: c.id, name: c.name, status: c.status, hasPolicy: !!policy,
      allowedModelClasses: policy?.allowedModelClasses ?? [], allowPublicAgents: policy?.allowPublicAgents ?? false,
      limitMicro: quota.limitMicro, spentMicro: quota.spentMicro, remainingMicro: quota.remainingMicro });
  }
  return result;
}
export async function usgRulePacksView(actor: Actor): Promise<UsgPack[]> {
  await requireConsole(actor);
  const db = getDb();
  const [rows, templates, versions, installations] = await Promise.all([
    db.select().from(rulePacks).orderBy(rulePacks.slug, desc(rulePacks.version)),
    db.select({ id: agentTemplates.id, name: agentTemplates.name, scope: agentTemplates.scope, latestVersion: agentTemplates.latestVersion })
      .from(agentTemplates).where(eq(agentTemplates.status, 'active')).orderBy(agentTemplates.name),
    db.select({ templateId: agentTemplateVersions.templateId, version: agentTemplateVersions.version, audience: agentTemplateVersions.audience,
      usableBy: agentTemplateVersions.usableBy, slug: agentTemplateVersions.rulePackSlug }).from(agentTemplateVersions),
    db.select({ templateId: agentInstallations.templateId, orgId: agentInstallations.orgId, track: agentInstallations.track, pinnedVersion: agentInstallations.pinnedVersion })
      .from(agentInstallations).where(eq(agentInstallations.enabled, true)),
  ]);
  const version = (templateId: string, n: number) => versions.find(v => v.templateId === templateId && v.version === n);
  const usersOf = (slug: string): UsgPackUser[] => templates.flatMap(t => {
    // An installation runs its pinned version, else the template's latest (§8 propagation).
    const effective = installations.filter(i => i.templateId === t.id)
      .map(i => ({ orgId: i.orgId, version: version(t.id, i.track === 'pinned' && i.pinnedVersion !== null ? i.pinnedVersion : t.latestVersion) }))
      .filter(i => i.version?.slug === slug);
    const latest = version(t.id, t.latestVersion);
    const shown = latest?.slug === slug ? latest : effective.map(i => i.version!).sort((a, b) => b.version - a.version)[0];
    if (!shown) return [];
    return [{ templateId: t.id, name: t.name, version: shown.version, audience: shown.audience, usableBy: shown.usableBy,
      installedCount: new Set(effective.map(i => i.orgId)).size, global: t.scope === 'global' }];
  });
  const packs = new Map<string, UsgPack>();
  for (const r of rows) {
    const pack = packs.get(r.slug) ?? { slug: r.slug, versions: [], usedBy: usersOf(r.slug) };
    pack.versions.push({ version: r.version, status: r.status, label: r.label,
      content: r.content && typeof r.content === 'object' && !Array.isArray(r.content) ? r.content as Record<string, unknown> : {},
      publishedAt: r.publishedAt?.toISOString() ?? null });
    packs.set(r.slug, pack);
  }
  return [...packs.values()];
}
