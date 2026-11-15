// Owner: B (WP-5). The database half of distribution: load installations with the version their
// track resolves to, plus everything the clamps need about the club, and hand it to compose.
//
// The distribution tables carry no RLS (I2 covers documents and agent_runs), so they are read with
// getDb(), the same way authz reads memberships.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { isUuid } from '../authz';
import type { EffectiveAgent, ModelClass } from '../contracts';
import { getDb } from '../db/client';
import {
  agentInstallations,
  agentTemplates,
  agentTemplateVersions,
  orgs,
  positions,
  rulePacks,
  sources,
  usgClubPolicy,
} from '../db/schema';
import { composeEffectiveAgent } from './compose';

/** Source kinds that live in the USG org rather than the club (§8 clamps table). */
const USG_SOURCE_KINDS = ['rulebook', 'usg_internal'];

/**
 * An installation's effective version: the template's latest, or the pinned one.
 * `latest` resolves at read time, so a USG republish reaches every club that did not pin.
 */
const resolvedVersion = sql`case when ${agentInstallations.track} = 'pinned'
  then ${agentInstallations.pinnedVersion} else ${agentTemplates.latestVersion} end`;

export interface AgentFilter {
  installationId?: string;
  orgIds?: string[];
  /** Only installations the club has switched on. */
  enabledOnly?: boolean;
}

/**
 * Loads installations and composes each into the config a run would use. Returns them in a stable
 * order (club name, then agent name) so pages do not reshuffle between requests.
 */
export async function loadAgents(filter: AgentFilter): Promise<EffectiveAgent[]> {
  // An id from a URL reaches us as free text. Postgres would reject a malformed uuid with a
  // query error; callers expect "no such installation" instead.
  if (filter.installationId && !isUuid(filter.installationId)) return [];
  if (filter.orgIds?.some((id) => !isUuid(id))) return [];

  const db = getDb();

  const where = [
    filter.installationId ? eq(agentInstallations.id, filter.installationId) : undefined,
    filter.orgIds ? inArray(agentInstallations.orgId, filter.orgIds) : undefined,
    filter.enabledOnly ? eq(agentInstallations.enabled, true) : undefined,
  ].filter(Boolean);

  const rows = await db
    .select({
      installationId: agentInstallations.id,
      orgId: agentInstallations.orgId,
      orgName: orgs.name,
      enabled: agentInstallations.enabled,
      instAudience: agentInstallations.audience,
      instUsableBy: agentInstallations.usableBy,
      promptAddendum: agentInstallations.promptAddendum,
      extraSourceIds: agentInstallations.extraSourceIds,
      instModelClass: agentInstallations.modelClass,
      slug: agentTemplates.slug,
      name: agentTemplates.name,
      templateStatus: agentTemplates.status,
      version: agentTemplateVersions.version,
      purpose: agentTemplateVersions.purpose,
      audience: agentTemplateVersions.audience,
      usableBy: agentTemplateVersions.usableBy,
      maxTier: agentTemplateVersions.maxTier,
      sourceKinds: agentTemplateVersions.sourceKinds,
      tools: agentTemplateVersions.tools,
      modelClasses: agentTemplateVersions.modelClasses,
      defaultModelClass: agentTemplateVersions.defaultModelClass,
      systemPrompt: agentTemplateVersions.systemPrompt,
      rulePackSlug: agentTemplateVersions.rulePackSlug,
    })
    .from(agentInstallations)
    .innerJoin(agentTemplates, eq(agentTemplates.id, agentInstallations.templateId))
    .innerJoin(
      agentTemplateVersions,
      and(
        eq(agentTemplateVersions.templateId, agentTemplates.id),
        eq(agentTemplateVersions.version, resolvedVersion),
      ),
    )
    .innerJoin(orgs, eq(orgs.id, agentInstallations.orgId))
    .where(where.length ? and(...where) : undefined)
    .orderBy(orgs.name, agentTemplates.name);

  if (rows.length === 0) return [];

  const ctx = await loadClubContext(rows.map((r) => r.orgId));
  const packs = await loadRulePacks(rows.map((r) => r.rulePackSlug).filter((s): s is string => s !== null));

  return rows.map((r) =>
    composeEffectiveAgent({
      template: { slug: r.slug, name: r.name, status: r.templateStatus },
      version: {
        version: r.version,
        purpose: r.purpose,
        audience: r.audience,
        usableBy: r.usableBy,
        maxTier: r.maxTier,
        tools: r.tools,
        modelClasses: r.modelClasses,
        defaultModelClass: r.defaultModelClass,
        systemPrompt: r.systemPrompt,
      },
      installation: {
        id: r.installationId,
        orgId: r.orgId,
        enabled: r.enabled,
        audience: r.instAudience,
        usableBy: r.instUsableBy,
        promptAddendum: r.promptAddendum,
        extraSourceIds: r.extraSourceIds,
        modelClass: r.instModelClass,
      },
      club: {
        policy: ctx.policy.get(r.orgId) ?? { allowedModelClasses: [], allowPublicAgents: false },
        positionSlugs: ctx.positions.get(r.orgId) ?? [],
        ownedSourceIds: ctx.ownedSources.get(r.orgId) ?? [],
        // TODO(WP-7): the club's monthly limit lives in A's quota_limits and is only compared
        // against an installation budget, which has no column yet, so no clamp reads it today.
        quotaMicro: Number.MAX_SAFE_INTEGER,
      },
      baseSourceIds: resolveSourceKinds(r.sourceKinds, r.orgId, ctx),
      rulePack: r.rulePackSlug ? packs.get(r.rulePackSlug) : undefined,
    }),
  );
}

interface ClubContext {
  policy: Map<string, { allowedModelClasses: ModelClass[]; allowPublicAgents: boolean }>;
  positions: Map<string, string[]>;
  ownedSources: Map<string, string[]>;
  /** org id → kind → source id, for both the club and USG. */
  sourcesByKind: Map<string, Map<string, string>>;
  usgOrgId: string | null;
}

async function loadClubContext(orgIds: string[]): Promise<ClubContext> {
  const db = getDb();
  const usg = await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.kind, 'usg')).limit(1);
  const usgOrgId = usg[0]?.id ?? null;
  const wanted = [...new Set([...orgIds, ...(usgOrgId ? [usgOrgId] : [])])];

  const [policyRows, positionRows, sourceRows] = await Promise.all([
    db.select().from(usgClubPolicy).where(inArray(usgClubPolicy.orgId, wanted)),
    db.select({ orgId: positions.orgId, slug: positions.slug }).from(positions).where(inArray(positions.orgId, wanted)),
    db
      .select({ id: sources.id, orgId: sources.orgId, kind: sources.kind })
      .from(sources)
      .where(inArray(sources.orgId, wanted)),
  ]);

  const ctx: ClubContext = {
    policy: new Map(policyRows.map((p) => [p.orgId, { allowedModelClasses: p.allowedModelClasses, allowPublicAgents: p.allowPublicAgents }])),
    positions: new Map(),
    ownedSources: new Map(),
    sourcesByKind: new Map(),
    usgOrgId,
  };

  for (const p of positionRows) {
    ctx.positions.set(p.orgId, [...(ctx.positions.get(p.orgId) ?? []), p.slug]);
  }
  for (const s of sourceRows) {
    ctx.ownedSources.set(s.orgId, [...(ctx.ownedSources.get(s.orgId) ?? []), s.id]);
    const byKind = ctx.sourcesByKind.get(s.orgId) ?? new Map<string, string>();
    byKind.set(s.kind, s.id);
    ctx.sourcesByKind.set(s.orgId, byKind);
  }
  return ctx;
}

/** A version names source *kinds*; they resolve per club, except USG's own rulebook (§8). */
function resolveSourceKinds(kinds: string[], orgId: string, ctx: ClubContext): string[] {
  const ids: string[] = [];
  for (const kind of kinds) {
    const owner = USG_SOURCE_KINDS.includes(kind) ? ctx.usgOrgId : orgId;
    const id = owner ? ctx.sourcesByKind.get(owner)?.get(kind) : undefined;
    // A club with no source of that kind simply contributes nothing — the agent reads less,
    // rather than failing to load.
    if (id) ids.push(id);
  }
  return ids;
}

/** Runs use the latest *published* version of a pack (§8 propagation), so D6's v2 takes effect. */
async function loadRulePacks(slugs: string[]): Promise<Map<string, EffectiveAgent['rulePack']>> {
  if (slugs.length === 0) return new Map();
  const db = getDb();
  const rows = await db
    .select({
      slug: rulePacks.slug,
      version: rulePacks.version,
      label: rulePacks.label,
      content: rulePacks.content,
    })
    .from(rulePacks)
    .where(and(inArray(rulePacks.slug, [...new Set(slugs)]), eq(rulePacks.status, 'published')))
    .orderBy(desc(rulePacks.version));

  const latest = new Map<string, EffectiveAgent['rulePack']>();
  for (const r of rows) if (!latest.has(r.slug)) latest.set(r.slug, r);
  return latest;
}
