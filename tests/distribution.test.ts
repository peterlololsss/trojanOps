// Owner: B (WP-5). Invariant I7: distribution never widens. A template version is the ceiling and
// usg_club_policy is a second ceiling above it; an installation may only narrow. These are the
// acceptance check for D2's rejected widening, and they are pure — no database.
import { afterAll, describe, expect, it } from 'vitest';
import { clampInstallation } from '@/lib/distribution/clamps';
import { directory, effectiveAgent, myAgents } from '@/lib/distribution';
import type { Audience, ModelClass, Tier } from '@/lib/contracts';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import { appSql, closeAppDb } from './db';

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

// ---------------------------------------------------------------------------
// The DB-backed half, against the seeded database.
// ---------------------------------------------------------------------------

const probe = await appSql();
await probe?.end();
afterAll(async () => {
  if (probe) await closeAppDb();
});

describe.skipIf(!probe)('effectiveAgent · version, clamps and rule pack', () => {
  it('reports a switched-off installation instead of throwing, for the gateway to refuse', async () => {
    expect((await effectiveAgent(INSTALLATION.startupRecruitingQa)).status).toBe('disabled');
  });

  it('caps a public agent at the public tier', async () => {
    expect((await effectiveAgent(INSTALLATION.danceShowcaseQa)).maxTier).toBe('public');
  });

  it("honours the version's default model class", async () => {
    expect((await effectiveAgent(INSTALLATION.danceShowcaseQa)).modelClass).toBe('economy');
  });

  it('attaches the rule pack to the funding pre-check and to nothing else', async () => {
    expect((await effectiveAgent(INSTALLATION.startupFundingPrecheck)).rulePack?.slug).toBe('usg-funding');
    expect((await effectiveAgent(INSTALLATION.usgReviewAssistant)).rulePack).toBeUndefined();
  });

  it('refuses an installation that does not exist', async () => {
    await expect(effectiveAgent(ORG.usg)).rejects.toThrow();
  });
});

describe.skipIf(!probe)('myAgents · every club judged in that club', () => {
  it('gives Casey, a plain Startup member, the members agent only', async () => {
    const clubs = await myAgents(USER.casey);
    expect(clubs.map((c) => c.orgId)).toEqual([ORG.startup]);
    expect(clubs[0].agents.map((a) => a.templateSlug)).toEqual(['handoff']);
    expect(clubs[0].agents[0].reasonLabel).toBe('All members');
  });

  it('gives Taylor the funding pre-check as well, labelled by position', async () => {
    const [startup] = await myAgents(USER.taylor);
    expect(startup.agents.map((a) => a.templateSlug).sort()).toEqual(['funding-precheck', 'handoff']);
    const precheck = startup.agents.find((a) => a.templateSlug === 'funding-precheck');
    expect(precheck?.reasonLabel).toBe('Treasurer, President');
  });

  // The cross-club case: Morgan is Archery's treasurer and a plain member of Startup, so the
  // pre-check follows her position in Archery and must not follow her into Startup.
  it("gives Morgan Archery's pre-check but not Startup's", async () => {
    const byOrg = new Map(
      (await myAgents(USER.morgan)).map((c) => [c.orgId, c.agents.map((a) => a.templateSlug)]),
    );
    expect(byOrg.get(ORG.archery)).toContain('funding-precheck');
    expect(byOrg.get(ORG.startup)).toContain('handoff');
    expect(byOrg.get(ORG.startup)).not.toContain('funding-precheck');
  });

  it('gives Lee, who is in no club, nothing', async () => {
    expect(await myAgents(USER.lee)).toEqual([]);
  });
});

describe.skipIf(!probe)('directory · enabled public agents only', () => {
  it("lists Dance's showcase Q&A and withholds Startup's unpublished recruiting Q&A", async () => {
    const slugs = (await directory()).map((a) => a.templateSlug);
    expect(slugs).toContain('showcase-qa');
    expect(slugs).not.toContain('recruiting-qa'); // D3 publishes it on stage
  });

  it('labels every listing for any signed-in student', async () => {
    for (const listing of await directory()) {
      expect(listing.audience).toBe('public');
      expect(listing.reasonLabel).toBe('All students');
    }
  });
});
