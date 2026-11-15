// Owner: B (WP-5). Invariant I7: distribution never widens. A template version is the ceiling and
// usg_club_policy is a second ceiling above it; an installation may only narrow. These are the
// acceptance check for D2's rejected widening, and they are pure — no database.
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clampInstallation } from '@/lib/distribution/clamps';
import { FIXTURE_AGENTS, resetDistributionFixtures } from '@/lib/distribution/fixtures';
import type { Audience, ModelClass, Tier } from '@/lib/contracts';
import { appSql } from './db';

const baseVersion = {
  audience: 'positions' as Audience,
  usableBy: ['treasurer', 'president'],
  maxTier: 'officers' as Tier,
  tools: ['submit_to_queue'],
  modelClasses: ['standard', 'economy'] as ModelClass[],
  defaultModelClass: 'standard' as ModelClass,
};

const baseClub = {
  policy: {
    allowedModelClasses: ['standard', 'economy'] as ModelClass[],
    allowPublicAgents: true,
  },
  positionSlugs: ['president', 'treasurer', 'secretary', 'member'],
  ownedSourceIds: ['src-public', 'src-minutes', 'src-finance'],
  quotaMicro: 5_000_000,
};

function clamp(
  version: Partial<typeof baseVersion> = {},
  installation: Parameters<typeof clampInstallation>[0]['installation'] = {},
  club: Partial<typeof baseClub> = {},
) {
  return clampInstallation({
    version: { ...baseVersion, ...version },
    installation,
    club: { ...baseClub, ...club },
  });
}

/** Narrow to the success branch, failing loudly otherwise. */
function allowed(result: ReturnType<typeof clamp>) {
  if (!result.ok) throw new Error(`expected allowed, got a violation on ${result.violation.field}`);
  return result.effective;
}

describe('clamps · audience', () => {
  it('refuses to widen a members-only agent to the whole campus', () => {
    const r = clamp({ audience: 'members' }, { audience: 'public' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.field).toBe('audience');
  });

  it('allows narrowing a public agent to members', () => {
    const r = clamp({ audience: 'public', maxTier: 'public' }, { audience: 'members' });
    expect(allowed(r).audience).toBe('members');
  });

  it('allows narrowing a members agent to named positions', () => {
    const r = clamp(
      { audience: 'members', usableBy: [] },
      { audience: 'positions', usableBy: ['secretary'] },
    );
    expect(allowed(r).audience).toBe('positions');
  });

  it('refuses a public audience when USG has turned public agents off for the club', () => {
    const r = clamp(
      { audience: 'public', maxTier: 'public' },
      { audience: 'public' },
      { policy: { allowedModelClasses: ['standard', 'economy'], allowPublicAgents: false } },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.field).toBe('audience');
  });
});

describe('clamps · max tier', () => {
  // Invariant I4, and the reason a club can open an agent to all students without
  // leaking its minutes or its budget.
  it('forces a public agent down to the public tier', () => {
    const r = clamp({ audience: 'public', maxTier: 'officers' }, { audience: 'public' });
    expect(allowed(r).maxTier).toBe('public');
  });

  it("keeps the version's max tier for an internal agent", () => {
    const r = clamp({ audience: 'members', maxTier: 'officers' }, {});
    expect(allowed(r).maxTier).toBe('officers');
  });

  it("forces the public tier even when the club narrows a public agent's audience later", () => {
    const r = clamp({ audience: 'public', maxTier: 'public' }, { audience: 'members' });
    expect(allowed(r).maxTier).toBe('public');
  });

  // The version row itself can carry a tier above what I4 allows for its audience; narrowing the
  // audience must not hand the installation reads the version never had.
  it('caps the version at the public tier before the installation narrows the audience', () => {
    const r = clamp({ audience: 'public', maxTier: 'officers' }, { audience: 'members' });
    expect(allowed(r).maxTier).toBe('public');
  });
});

describe('clamps · usable_by', () => {
  it("accepts a subset of a positions version's list", () => {
    expect(allowed(clamp({}, { usableBy: ['treasurer'] })).usableBy).toEqual(['treasurer']);
  });

  it('refuses a position the version did not list', () => {
    const r = clamp({}, { usableBy: ['treasurer', 'secretary'] });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.field).toBe('usableBy');
      expect(r.violation.allowed).toEqual(['treasurer', 'president']);
    }
  });

  it('lets a members version name any position the club actually has', () => {
    const r = clamp(
      { audience: 'members', usableBy: [] },
      { audience: 'positions', usableBy: ['secretary'] },
    );
    expect(allowed(r).usableBy).toEqual(['secretary']);
  });

  it('refuses a position the club does not have', () => {
    const r = clamp(
      { audience: 'members', usableBy: [] },
      { audience: 'positions', usableBy: ['provost'] },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.field).toBe('usableBy');
  });

  // contracts.ts: usableBy is empty unless the audience is 'positions'. A stray list would
  // otherwise reach AgentListing.reasonLabel and name positions on a members-wide agent.
  it('drops a position list on an audience that is not positions', () => {
    const r = clamp({ audience: 'members', usableBy: [] }, { usableBy: ['president'] });
    expect(allowed(r).usableBy).toEqual([]);
  });

  it('refuses a positions audience that names nobody', () => {
    const r = clamp({ audience: 'members', usableBy: [] }, { audience: 'positions', usableBy: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.field).toBe('usableBy');
  });
});

describe('clamps · model class', () => {
  // D2: Sam tries to give event-planning the standard class; its v1 allows economy
  // only. The rejection names the cap and is audited as installation.rejected.
  it('refuses a model class the version forbids', () => {
    const r = clamp({ modelClasses: ['economy'] }, { modelClass: 'standard' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.field).toBe('modelClass');
      expect(r.violation.allowed).toEqual(['economy']);
    }
  });

  it('refuses a model class USG forbids for the club', () => {
    const r = clamp(
      {},
      { modelClass: 'standard' },
      { policy: { allowedModelClasses: ['economy'], allowPublicAgents: true } },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.field).toBe('modelClass');
  });

  it('accepts one that both the version and USG allow', () => {
    expect(allowed(clamp({}, { modelClass: 'economy' })).modelClass).toBe('economy');
  });

  // §5 has a default_model_class column; without it, seeded agents whose default is economy
  // would silently run on standard and stop matching the fixtures.
  it("inherits the version's default when the club sets nothing", () => {
    expect(allowed(clamp({ defaultModelClass: 'economy' }, {})).modelClass).toBe('economy');
  });

  it('falls back to an allowed class when USG forbids the default', () => {
    const r = clamp(
      { defaultModelClass: 'standard' },
      {},
      { policy: { allowedModelClasses: ['economy'], allowPublicAgents: true } },
    );
    expect(allowed(r).modelClass).toBe('economy');
  });

  it('refuses when USG allows none of the version’s classes', () => {
    const r = clamp(
      { modelClasses: ['standard'], defaultModelClass: 'standard' },
      {},
      { policy: { allowedModelClasses: ['economy'], allowPublicAgents: true } },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.field).toBe('modelClass');
  });
});

describe('clamps · tools and sources', () => {
  it('takes tools from the version: an installation cannot add one', () => {
    expect(allowed(clamp({}, {})).tools).toEqual(['submit_to_queue']);
  });

  it('accepts extra sources the club owns', () => {
    const r = clamp({}, { extraSourceIds: ['src-minutes'] });
    expect(allowed(r).extraSourceIds).toEqual(['src-minutes']);
  });

  it('refuses a source belonging to another club', () => {
    const r = clamp({}, { extraSourceIds: ['src-archery-finance'] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.violation.field).toBe('extraSourceIds');
  });
});

describe('clamps · installation quota', () => {
  it("accepts a budget within the club's", () => {
    expect(allowed(clamp({}, { quotaMicro: 2_500_000 })).quotaMicro).toBe(2_500_000);
  });

  it("refuses a budget larger than the club's", () => {
    const r = clamp({}, { quotaMicro: 9_000_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.field).toBe('quotaMicro');
      expect(r.violation.allowed).toBe(5_000_000);
    }
  });
});

describe('clamps · every violation is reportable', () => {
  it('names the field and what was allowed, for the ApiError cap and the audit row', () => {
    const r = clamp({ modelClasses: ['economy'] }, { modelClass: 'standard' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.violation.field).toBeTruthy();
      expect(r.violation.allowed).toBeDefined();
      expect(r.violation.message.length).toBeGreaterThan(0);
    }
  });
});

// db/seed/ids.ts: "Stubs and tests use these, so fixtures match the real seed." Until WP-5
// resolves installations from the database, the stubs are what C and D render, so the two have to
// say the same thing — a divergence shows up on stage, not in a type error.
describe('seed · the stubs and the seeded rows agree', () => {
  let sql: postgres.Sql | null = null;

  beforeAll(async () => {
    resetDistributionFixtures();
    sql = await appSql();
  });

  afterAll(async () => {
    await sql?.end({ timeout: 1 });
  });

  it('agrees on slug, audience, positions, max tier, model class, rule pack and enabled state', async () => {
    if (!sql) return; // appSql already warned that the database is unreachable
    const rows = await sql`
      select i.id, i.enabled, t.slug, v.audience, v.usable_by, v.max_tier,
             v.default_model_class, v.rule_pack_slug
      from agent_installations i
      join agent_templates t on t.id = i.template_id
      join agent_template_versions v on v.template_id = t.id and v.version = t.latest_version`;

    expect(rows.length).toBe(Object.keys(FIXTURE_AGENTS).length);

    for (const row of rows) {
      const fixture = FIXTURE_AGENTS[row.id as string];
      expect(fixture, `no fixture for seeded installation ${row.id}`).toBeDefined();
      expect(fixture.templateSlug).toBe(row.slug);
      expect(fixture.audience).toBe(row.audience);
      expect(fixture.usableBy).toEqual(row.usable_by);
      expect(fixture.maxTier).toBe(row.max_tier);
      expect(fixture.modelClass).toBe(row.default_model_class);
      expect(Boolean(fixture.rulePack)).toBe(row.rule_pack_slug !== null);
      expect(fixture.status === 'enabled').toBe(row.enabled);
    }
  });
});
