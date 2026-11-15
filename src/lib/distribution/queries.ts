// Owner: B (WP-5). The database half of distribution: load installations with the version their
// track resolves to, plus everything the clamps need about the club, and hand it to compose.
//
// The distribution tables carry no RLS (I2 covers documents and agent_runs), so they are read with
// getDb(), the same way authz reads memberships.
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { isUuid } from '../authz';
import { AppError, type EffectiveAgent, type ModelClass } from '../contracts';
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

import { composeEffectiveAgent, type ComposeInput } from './compose';

/** Source kinds that live in the USG org rather than the club (§8 clamps table). */
const USG_SOURCE_KINDS = ['rulebook', 'usg_internal'];

/**
 * An installation's effective version: the pinned one, or the template's latest.
 *
 * `pinned_version` is nullable and the schema has no constraint tying it to `track`, so a row that
 * says `pinned` without a version falls back to latest rather than resolving to NULL and matching
 * no version at all.
 *
 * TODO(verify): worth a `check (track <> 'pinned' or pinned_version is not null)` on A's schema —
 * a contract change, so it is their call.
 */
const resolvedVersion = sql`case
  when ${agentInstallations.track} = 'pinned' and ${agentInstallations.pinnedVersion} is not null
  then ${agentInstallations.pinnedVersion} else ${agentTemplates.latestVersion} end`;

export interface AgentFilter {
  installationId?: string;
  orgIds?: string[];
  /** Only agents a club has switched on, whose template is not retired. */
  enabledOnly?: boolean;
}

export interface LoadedAgent {
  agent: EffectiveAgent;
  orgName: string;
}

/**
 * Loads installations and composes each into the config a run would use, in a stable order (club
 * name, then agent name) so pages do not reshuffle between requests.
 *
 * One unloadable installation never takes a list down with it: a row whose version cannot be
 * resolved, or that a clamp now rejects, is skipped with a warning rather than throwing —
 * `directory()` serves the whole campus, so a single bad row must not 500 it. Asking for one
 * installation by id is different: the caller is about to act on it, so a clamp violation is
 * thrown, in a generic form, instead of reading as "no such agent".
 */
export async function loadAgents(filter: AgentFilter): Promise<LoadedAgent[]> {
  // An id from a URL reaches us as free text. Postgres would reject a malformed uuid with a query
  // error; callers expect "no such installation" instead.
  if (filter.installationId && !isUuid(filter.installationId)) return [];
  if (filter.orgIds?.some((id) => !isUuid(id))) return [];

  const inputs = await loadComposeInputs(filter);

  const loaded: LoadedAgent[] = [];
  for (const { input, orgName } of inputs) {
    try {
      const agent = composeEffectiveAgent(input);
      if (filter.enabledOnly && agent.status !== 'enabled') continue;
      loaded.push({ agent, orgName });
    } catch (err) {
      if (filter.installationId && err instanceof AppError && err.error.code === 'clamp_violation') {
        // I7 runs the clamps at run time too: a version narrowed under an installation lands here.
        // Any signed-in user can ask for an installation by id (the gateway composes it before the
        // audience check), so nothing is audited and nothing internal leaves: the clamp's field,
        // allowed values and message can name another club's sources and positions.
        // `installation.rejected` belongs to the write paths.
        console.warn(`distribution: installation ${input.installation.id} is outside its version:`, err.error);
        throw new AppError({
          code: 'clamp_violation',
          message: 'This agent is configured beyond what its template allows, so it cannot run.',
        });
      }
      // A clamp that now rejects a row written earlier, or a club with no usg_club_policy.
      console.warn(`distribution: skipping installation ${input.installation.id}:`, err);
    }
  }
  return loaded;
}


/** The composed config for one installation, or null when it does not resolve. A clamp violation
 * on the row is thrown, not hidden. */
export async function loadAgent(installationId: string): Promise<EffectiveAgent | null> {
  const [first] = await loadAgents({ installationId });
  return first?.agent ?? null;
}


interface LoadedInput {
  input: ComposeInput;
  orgName: string;
}

async function loadComposeInputs(filter: AgentFilter): Promise<LoadedInput[]> {
  const db = getDb();

  const where = [
    filter.installationId ? eq(agentInstallations.id, filter.installationId) : undefined,
    filter.orgIds ? inArray(agentInstallations.orgId, filter.orgIds) : undefined,
    filter.enabledOnly ? eq(agentInstallations.enabled, true) : undefined,
  ].filter(Boolean);

  // leftJoin, not inner: an installation whose version cannot be resolved must be reported, not
  // quietly dropped from the club's catalog and the directory.
  const rows = await db
    .select({
      installationId: agentInstallations.id,
      orgId: agentInstallations.orgId,
      orgName: orgs.name,
      enabled: agentInstallations.enabled,
      track: agentInstallations.track,
      pinnedVersion: agentInstallations.pinnedVersion,
      instAudience: agentInstallations.audience,
      instUsableBy: agentInstallations.usableBy,
      promptAddendum: agentInstallations.promptAddendum,
      extraSourceIds: agentInstallations.extraSourceIds,
      instModelClass: agentInstallations.modelClass,
      slug: agentTemplates.slug,
      name: agentTemplates.name,
      templateStatus: agentTemplates.status,
      latestVersion: agentTemplates.latestVersion,
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
    .leftJoin(
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

  const inputs: LoadedInput[] = [];
  for (const r of rows) {
    if (r.version === null) {
      const wanted = r.track === 'pinned' ? r.pinnedVersion : r.latestVersion;
      console.warn(
        `distribution: installation ${r.installationId} (${r.slug}) pins version ${wanted}, which is not published`,
      );
      continue;
    }
    inputs.push({
      orgName: r.orgName,
      input: {
        template: { slug: r.slug, name: r.name, status: r.templateStatus },
        version: {
          version: r.version,
          purpose: r.purpose!,
          audience: r.audience!,
          usableBy: r.usableBy!,
          maxTier: r.maxTier!,
          tools: r.tools!,
          modelClasses: r.modelClasses!,
          defaultModelClass: r.defaultModelClass!,
          systemPrompt: r.systemPrompt!,
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
          // TODO(verify): the club's monthly limit lives in A's quota_limits, and an installation's
          // budget has no column of its own (it is a quota_limits row), so no clamp here reads it
          // and this stays unbounded. WP-7's `updateInstallation` must not rely on this value: it
          // passes the club limit from `remaining({scope:'org'})` to the clamp when it checks a
          // proposed installation budget.
          quotaMicro: Number.MAX_SAFE_INTEGER,
        },
        baseSourceIds: resolveSourceKinds(r.sourceKinds!, r.orgId, ctx),
        rulePack: r.rulePackSlug ? packs.get(r.rulePackSlug) : undefined,
      },
    });
  }
  return inputs;
}

interface ClubContext {
  policy: Map<string, { allowedModelClasses: ModelClass[]; allowPublicAgents: boolean }>;
  positions: Map<string, string[]>;
  ownedSources: Map<string, string[]>;
  /** org id → kind → every source of that kind, in a stable order. */
  sourcesByKind: Map<string, Map<string, string[]>>;
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
      .select({ id: sources.id, orgId: sources.orgId, kind: sources.kind, slug: sources.slug })
      .from(sources)
      .where(inArray(sources.orgId, wanted))
      // `sources` is unique on (org_id, slug), not (org_id, kind), so a club may own several of a
      // kind. Order them so a run reads the same documents on every request.
      .orderBy(sources.slug),
  ]);

  const ctx: ClubContext = {
    policy: new Map(
      policyRows.map((p) => [p.orgId, { allowedModelClasses: p.allowedModelClasses, allowPublicAgents: p.allowPublicAgents }]),
    ),
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
    const byKind = ctx.sourcesByKind.get(s.orgId) ?? new Map<string, string[]>();
    byKind.set(s.kind, [...(byKind.get(s.kind) ?? []), s.id]);
    ctx.sourcesByKind.set(s.orgId, byKind);
  }
  return ctx;
}

/** A version names source *kinds*; they resolve per club, except USG's own rulebook (§8). */
function resolveSourceKinds(kinds: string[], orgId: string, ctx: ClubContext): string[] {
  const ids: string[] = [];
  for (const kind of kinds) {
    const owner = USG_SOURCE_KINDS.includes(kind) ? ctx.usgOrgId : orgId;
    const found = owner ? ctx.sourcesByKind.get(owner)?.get(kind) : undefined;
    if (found?.length) {
      ids.push(...found);
    } else {
      // The agent reads less rather than failing to load — but say so, because §8's publish
      // confirmation counts readable documents and a silent gap would understate it.
      console.warn(`distribution: no '${kind}' source in org ${owner ?? '(no USG org)'}`);
    }
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
