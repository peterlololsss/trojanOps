// Owner: B (WP-5). Invariant I7: distribution never widens. A template version is the ceiling and
// usg_club_policy is a second ceiling above it; an installation may only narrow. These are the
// acceptance check for D2's rejected widening, and they are pure — no database.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { clampInstallation } from '@/lib/distribution/clamps';
import { directory, effectiveAgent, myAgents, publishToAllStudents } from '@/lib/distribution';
import { loadAgents } from '@/lib/distribution/queries';
import { remaining } from '@/lib/gateway/quota';
import type { Audience, ModelClass, Tier } from '@/lib/contracts';
import { getDb } from '@/lib/db/client';
import { agentInstallations } from '@/lib/db/schema';
import { INSTALLATION, ORG, USER } from '@db/seed/ids';
import type { Tx } from '@/lib/db/client';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

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

  // §8: retire blocks runs, so a retired agent must not be offered either. The deleted stub
  // filtered on status; the query layer has to keep doing it.
  it('withholds a retired template', () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(sql`update agent_templates set status = 'retired' where slug = 'showcase-qa'`);
      expect((await directory()).map((a) => a.templateSlug)).not.toContain('showcase-qa');
    }));
});

describe.skipIf(!probe)('loadAgents · nothing disappears quietly', () => {
  it('composes every seeded installation', async () => {
    const [{ count }] = await getDb().select({ count: sql<number>`count(*)::int` }).from(agentInstallations);
    expect((await loadAgents({})).length).toBe(count);
  });

  // pinned_version is nullable and no constraint ties it to track, so a row like this is
  // reachable. It used to resolve to NULL, match no version, and vanish from every page.
  it('falls back to the latest version when a pin names none', () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(
        sql`update agent_installations set track = 'pinned', pinned_version = null where id = ${INSTALLATION.startupHandoff}`,
      );
      const agent = await effectiveAgent(INSTALLATION.startupHandoff);
      expect(agent.templateVersion).toBe(1);
      expect((await myAgents(USER.casey))[0].agents.map((a) => a.templateSlug)).toContain('handoff');
    }));
});

describe.skipIf(!probe)('publishToAllStudents · D3', () => {
  const president = () => actorFor(USER.sam, ORG.startup);

  /** Rows this test wrote, counted from a baseline — audit_events is append-only and shared. */
  const auditedSince = async (tx: Tx, from: number, action: string) => {
    const rows = await tx.execute<{ id: number }>(
      sql`select id from audit_events where action = ${action} and id > ${from}`,
    );
    return rows.length;
  };

  const auditBaseline = async (tx: Tx) => {
    const [{ max }] = await tx.execute<{ max: string }>(
      sql`select coalesce(max(id), 0) as max from audit_events`,
    );
    return Number(max);
  };

  it('publishes, derives the public tier, and lands in the directory', () =>
    inRolledBackApp(async (tx) => {
      const from = await auditBaseline(tx);
      const published = await publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa);

      expect(published.audience).toBe('public');
      expect(published.maxTier).toBe('public'); // I4, derived not written
      expect(published.status).toBe('enabled');
      expect((await directory()).map((a) => a.templateSlug)).toContain('recruiting-qa');

      expect(await auditedSince(tx, from, 'agent.publish_public')).toBe(1);

      // §8: half the club's monthly quota, so an outside student cannot drain the club.
      const club = await remaining({ scope: 'org', orgId: ORG.startup });
      const installation = await remaining({
        scope: 'installation',
        orgId: ORG.startup,
        installationId: INSTALLATION.startupRecruitingQa,
      });
      expect(installation.limitMicro).toBe(Math.floor(club.limitMicro / 2));
    }));

  it('honours a limit the president chose instead of the default', () =>
    inRolledBackApp(async () => {
      await publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa, {
        limitMicro: 1_000_000,
      });
      const installation = await remaining({
        scope: 'installation',
        orgId: ORG.startup,
        installationId: INSTALLATION.startupRecruitingQa,
      });
      expect(installation.limitMicro).toBe(1_000_000);
    }));

  // The row must not be written past the clamps: a public row its version cannot justify would
  // throw out of every later read, taking the directory and every My agents page down with it.
  it('refuses to widen a members-only agent, and leaves the row untouched', () =>
    inRolledBackApp(async (tx) => {
      const from = await auditBaseline(tx);
      await expect(publishToAllStudents(await president(), INSTALLATION.startupHandoff)).rejects.toMatchObject({
        error: { code: 'clamp_violation' },
      });

      const [row] = await tx.execute<{ audience: string | null }>(
        sql`select audience from agent_installations where id = ${INSTALLATION.startupHandoff}`,
      );
      expect(row.audience).toBeNull();

      // The campus-wide reads still work for everyone else.
      expect(await directory()).toBeInstanceOf(Array);
      expect(await myAgents(USER.casey)).toBeInstanceOf(Array);

      expect(await auditedSince(tx, from, 'installation.rejected')).toBe(1);
    }));

  it('refuses a member who is not the president, and audits the refusal', () =>
    inRolledBackApp(async (tx) => {
      const from = await auditBaseline(tx);
      const casey = await actorFor(USER.casey, ORG.startup);
      await expect(publishToAllStudents(casey, INSTALLATION.startupRecruitingQa)).rejects.toMatchObject({
        error: { code: 'forbidden' },
      });
      expect(await auditedSince(tx, from, 'authz.denied')).toBe(1);
    }));
});
