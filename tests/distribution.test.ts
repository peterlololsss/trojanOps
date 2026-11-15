// Owner: B (WP-5). Invariant I7: distribution never widens. A template version is the ceiling and
// usg_club_policy is a second ceiling above it; an installation may only narrow. These are the
// acceptance check for D2's rejected widening, and they are pure — no database.
import { describe, expect, it } from 'vitest';
import { clampInstallation } from '@/lib/distribution/clamps';
import type { Audience, ModelClass, Tier } from '@/lib/contracts';

const baseVersion = {
  audience: 'positions' as Audience,
  usableBy: ['treasurer', 'president'],
  maxTier: 'officers' as Tier,
  tools: ['submit_to_queue'],
  modelClasses: ['standard', 'economy'] as ModelClass[],
};

const baseClub = {
  orgId: 'org-startup',
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
