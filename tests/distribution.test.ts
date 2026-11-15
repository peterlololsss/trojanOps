// Owner: B (WP-5). Invariant I7: distribution never widens. A template version is the ceiling and
// usg_club_policy is a second ceiling above it; an installation may only narrow. These are the
// acceptance check for D2's rejected widening, and they are pure — no database.
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { clampInstallation } from '@/lib/distribution/clamps';
import { composeEffectiveAgent, type ComposeInput } from '@/lib/distribution/compose';
import { directory, effectiveAgent, myAgents, publishToAllStudents } from '@/lib/distribution';
import { loadAgents } from '@/lib/distribution/queries';
import { remaining, setLimit } from '@/lib/gateway/quota';
import { AppError, type Audience, type ModelClass, type Tier } from '@/lib/contracts';
import { getDb } from '@/lib/db/client';
import { agentInstallations } from '@/lib/db/schema';
import { INSTALLATION, ORG, SOURCE, TEMPLATE, USER } from '@db/seed/ids';
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

describe('composeEffectiveAgent · version ⊗ installation', () => {
  const input = (over: Partial<ComposeInput> = {}): ComposeInput => ({
    template: { slug: 'funding-precheck', name: 'Funding pre-check', status: 'active' },
    version: {
      version: 2,
      purpose: 'Checks a request.',
      ...baseVersion,
      systemPrompt: 'You check requests.',
    },
    installation: {
      id: 'inst-1',
      orgId: 'org-1',
      enabled: true,
      audience: null,
      usableBy: null,
      promptAddendum: '',
      extraSourceIds: [],
      modelClass: null,
    },
    club: baseClub,
    baseSourceIds: ['src-public', 'src-finance'],
    ...over,
  });

  it('inherits the version when the installation overrides nothing', () => {
    const agent = composeEffectiveAgent(input());
    expect(agent).toMatchObject({
      installationId: 'inst-1',
      orgId: 'org-1',
      templateSlug: 'funding-precheck',
      templateVersion: 2,
      status: 'enabled',
      audience: 'positions',
      usableBy: ['treasurer', 'president'],
      maxTier: 'officers',
      modelClass: 'standard',
      tools: ['submit_to_queue'],
      systemPrompt: 'You check requests.',
    });
    expect(agent).not.toHaveProperty('rulePack');
  });

  it('reports retired over disabled, and disabled over enabled, instead of throwing', () => {
    const off = { ...input().installation, enabled: false };
    expect(composeEffectiveAgent(input({ installation: off })).status).toBe('disabled');
    expect(
      composeEffectiveAgent(
        input({ installation: off, template: { slug: 's', name: 'n', status: 'retired' } }),
      ).status,
    ).toBe('retired');
    expect(
      composeEffectiveAgent(input({ template: { slug: 's', name: 'n', status: 'retired' } })).status,
    ).toBe('retired');
  });

  it('appends the club addendum to the version prompt', () => {
    const agent = composeEffectiveAgent(
      input({ installation: { ...input().installation, promptAddendum: 'Be brief.' } }),
    );
    expect(agent.systemPrompt).toBe('You check requests.\n\nBe brief.');
  });

  it('adds the club extra sources to the version sources, without duplicates', () => {
    const agent = composeEffectiveAgent(
      input({ installation: { ...input().installation, extraSourceIds: ['src-minutes', 'src-public'] } }),
    );
    expect(agent.sourceIds).toEqual(['src-public', 'src-finance', 'src-minutes']);
  });

  it('carries the rule pack through', () => {
    const rulePack = { slug: 'usg-funding', version: 3, label: 'Demo rule pack', content: {} };
    expect(composeEffectiveAgent(input({ rulePack })).rulePack).toEqual(rulePack);
  });

  it('throws clamp_violation, naming the field, when the installation is wider than its version', () => {
    const wide = { ...input().installation, audience: 'public' as Audience };
    let thrown: unknown;
    try {
      composeEffectiveAgent(input({ installation: wide, club: { ...baseClub, policy: { ...baseClub.policy, allowPublicAgents: true } } }));
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(AppError);
    expect((thrown as AppError).error).toMatchObject({
      code: 'clamp_violation',
      cap: { scope: 'installation', field: 'audience' },
    });
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
    await expect(effectiveAgent(ORG.usg)).rejects.toMatchObject({ error: { code: 'not_found' } });
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

  /** Rows this test wrote about one target, counted from a baseline — audit_events is append-only
   * and shared. */
  const auditedSince = async (tx: Tx, from: number, action: string, targetId: string) => {
    const rows = await tx.execute<{ id: number }>(
      sql`select id from audit_events where action = ${action} and target_id = ${targetId} and id > ${from}`,
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

      expect(await auditedSince(tx, from, 'agent.publish_public', INSTALLATION.startupRecruitingQa)).toBe(1);
    }));

  const installationLimit = (installationId: string) =>
    remaining({ scope: 'installation', orgId: ORG.startup, installationId });

  /** The seed gives recruiting-qa its own 2.5M limit, which is also half of Startup's 5M. Move that
   * row to another installation so this one has none, and make the club's limit differ from 5M, so
   * the default can only come from halving the club's figure. */
  const withoutOwnLimit = async (tx: Tx) => {
    await tx.execute(
      sql`update quota_limits set installation_id = ${INSTALLATION.startupHandoff}
          where scope = 'installation' and installation_id = ${INSTALLATION.startupRecruitingQa}`,
    );
    await setLimit(await actorFor(USER.avery, ORG.usg), { scope: 'org', orgId: ORG.startup, limitMicro: 4_000_000 });
    expect((await installationLimit(INSTALLATION.startupRecruitingQa)).limitMicro).toBe(4_000_000); // falls back to the club
  };

  // §8: half the club's monthly quota, so an outside student cannot drain the club.
  it("defaults the installation limit to half the club's, and leaves the club's alone", () =>
    inRolledBackApp(async (tx) => {
      await withoutOwnLimit(tx);
      await publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa);

      expect((await installationLimit(INSTALLATION.startupRecruitingQa)).limitMicro).toBe(2_000_000);
      expect((await remaining({ scope: 'org', orgId: ORG.startup })).limitMicro).toBe(4_000_000);
      const rows = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from quota_limits
            where scope = 'installation' and installation_id = ${INSTALLATION.startupRecruitingQa}`,
      );
      expect(rows[0].n).toBe(1);
    }));

  it('keeps a limit the installation already has instead of resetting it to the default', () =>
    inRolledBackApp(async () => {
      await setLimit(await actorFor(USER.avery, ORG.usg), { scope: 'org', orgId: ORG.startup, limitMicro: 4_000_000 });
      await publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa);
      // The seeded 2.5M, not the 2M that half of 4M would give.
      expect((await installationLimit(INSTALLATION.startupRecruitingQa)).limitMicro).toBe(2_500_000);
    }));

  it('honours a limit the president chose instead of the default', () =>
    inRolledBackApp(async () => {
      await publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa, {
        limitMicro: 1_000_000,
      });
      expect((await installationLimit(INSTALLATION.startupRecruitingQa)).limitMicro).toBe(1_000_000);
      expect((await remaining({ scope: 'org', orgId: ORG.startup })).limitMicro).toBe(5_000_000);
    }));

  it("refuses a limit above the club's, and publishes nothing", () =>
    inRolledBackApp(async (tx) => {
      await expect(
        publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa, { limitMicro: 6_000_000 }),
      ).rejects.toMatchObject({ error: { code: 'clamp_violation' } });
      expect((await installationLimit(INSTALLATION.startupRecruitingQa)).limitMicro).toBe(2_500_000);
      const [row] = await tx.execute<{ audience: string | null; enabled: boolean }>(
        sql`select audience, enabled from agent_installations where id = ${INSTALLATION.startupRecruitingQa}`,
      );
      expect(row).toEqual({ audience: null, enabled: false });
    }));

  // Without a club limit every run of the agent would be blocked at the club level, and a 0
  // installation limit would only repeat that.
  it('refuses when the club has no monthly limit, and publishes nothing', () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(
        sql`update quota_limits set org_id = ${ORG.usg} where scope = 'org' and org_id = ${ORG.startup}`,
      );
      await tx.execute(
        sql`update quota_limits set installation_id = ${INSTALLATION.startupHandoff}
            where scope = 'installation' and installation_id = ${INSTALLATION.startupRecruitingQa}`,
      );
      await expect(publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa)).rejects.toMatchObject({
        error: { code: 'invalid' },
      });
      const [row] = await tx.execute<{ audience: string | null; enabled: boolean }>(
        sql`select audience, enabled from agent_installations where id = ${INSTALLATION.startupRecruitingQa}`,
      );
      expect(row).toEqual({ audience: null, enabled: false });
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

      expect(await auditedSince(tx, from, 'installation.rejected', INSTALLATION.startupHandoff)).toBe(1);
    }));

  it('refuses a member who is not the president, and audits the refusal', () =>
    inRolledBackApp(async (tx) => {
      const from = await auditBaseline(tx);
      const casey = await actorFor(USER.casey, ORG.startup);
      await expect(publishToAllStudents(casey, INSTALLATION.startupRecruitingQa)).rejects.toMatchObject({
        error: { code: 'forbidden' },
      });
      expect(await auditedSince(tx, from, 'authz.denied', INSTALLATION.startupRecruitingQa)).toBe(1);
    }));

  const unpublished = async (tx: Tx) => {
    const [row] = await tx.execute<{ audience: string | null; enabled: boolean }>(
      sql`select audience, enabled from agent_installations where id = ${INSTALLATION.startupRecruitingQa}`,
    );
    expect(row).toEqual({ audience: null, enabled: false });
  };

  // A public agent with a $0 budget would publish and then block every run.
  it('refuses an explicit limit of 0', () =>
    inRolledBackApp(async (tx) => {
      await expect(
        publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa, { limitMicro: 0 }),
      ).rejects.toMatchObject({ error: { code: 'invalid', message: expect.stringContaining('Recruiting Q&A') } });
      expect((await installationLimit(INSTALLATION.startupRecruitingQa)).limitMicro).toBe(2_500_000);
      await unpublished(tx);
    }));

  it('treats an own limit of 0 as absent, so the default applies', () =>
    inRolledBackApp(async (tx) => {
      await setLimit(await actorFor(USER.avery, ORG.usg), { scope: 'org', orgId: ORG.startup, limitMicro: 4_000_000 });
      await tx.execute(
        sql`update quota_limits set limit_micro = 0
            where scope = 'installation' and installation_id = ${INSTALLATION.startupRecruitingQa}`,
      );
      await publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa);
      expect((await installationLimit(INSTALLATION.startupRecruitingQa)).limitMicro).toBe(2_000_000);
      const rows = await tx.execute<{ n: number }>(
        sql`select count(*)::int as n from quota_limits
            where scope = 'installation' and installation_id = ${INSTALLATION.startupRecruitingQa}`,
      );
      expect(rows[0].n).toBe(1);
    }));

  it("refuses when half the club's limit rounds down to 0", () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(
        sql`update quota_limits set installation_id = ${INSTALLATION.startupHandoff}
            where scope = 'installation' and installation_id = ${INSTALLATION.startupRecruitingQa}`,
      );
      await tx.execute(
        sql`update quota_limits set limit_micro = 1 where scope = 'org' and org_id = ${ORG.startup}`,
      );
      await expect(publishToAllStudents(await president(), INSTALLATION.startupRecruitingQa)).rejects.toMatchObject({
        error: { code: 'invalid' },
      });
      await unpublished(tx);
    }));

  // Same denial for a real installation in another club, one that does not exist and a malformed
  // id, so the answer cannot be used to find out which ids exist.
  it("gives another club's president the same denial for a real id and a missing one", () =>
    inRolledBackApp(async (tx) => {
      const from = await auditBaseline(tx);
      const sam = await president();
      const denials = [];
      for (const id of [
        INSTALLATION.archeryFundingPrecheck,
        '00000000-0000-4000-8000-000000000999',
        'not-a-uuid',
      ]) {
        const err = await publishToAllStudents(sam, id).catch((e) => e);
        expect(err).toBeInstanceOf(AppError);
        denials.push(err.error);
        expect(await auditedSince(tx, from, 'authz.denied', id)).toBe(1);
      }
      expect(denials[0]).toMatchObject({ code: 'forbidden' });
      expect(denials[1]).toEqual(denials[0]);
      expect(denials[2]).toEqual(denials[0]);
    }));
});

// ---------------------------------------------------------------------------
// Resolution: sources, versions, rule packs, retirement and the run-time clamp.
// ---------------------------------------------------------------------------

/** Every query below reads the same way a request would; these write rows in the rolled-back
 * transaction directly, because the publish and retire services are WP-6/7. */
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {});

describe.skipIf(!probe)('effectiveAgent · sources resolve per club (§8)', () => {
  it("reads USG's rulebook and the club's finance for the funding pre-check", async () => {
    const { sourceIds } = await effectiveAgent(INSTALLATION.startupFundingPrecheck);
    expect([...sourceIds].sort()).toEqual([SOURCE.startup.finance, SOURCE.usg.rulebook].sort());
  });

  it("resolves the other kinds in the installing club, so Archery's agent reads Archery's documents", async () => {
    const { sourceIds } = await effectiveAgent(INSTALLATION.archeryFundingPrecheck);
    expect([...sourceIds].sort()).toEqual([SOURCE.archery.finance, SOURCE.usg.rulebook].sort());
  });

  it('resolves every kind of a club-wide agent, in the order the version lists them', async () => {
    const { sourceIds } = await effectiveAgent(INSTALLATION.startupHandoff);
    expect(sourceIds).toEqual([
      SOURCE.startup.public,
      SOURCE.startup.minutes,
      SOURCE.startup.archive,
      SOURCE.startup.finance,
    ]);
  });

  it("reads usg_internal from the USG org, which only USG's own agent names", async () => {
    const { sourceIds } = await effectiveAgent(INSTALLATION.usgReviewAssistant);
    expect(sourceIds).toEqual([SOURCE.usg.rulebook, SOURCE.usg.usg_internal]);
  });

  it('includes every source of a kind when a club owns several, in slug order', () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(
        sql`insert into sources (org_id, slug, name, kind, created_at)
            values (${ORG.startup}, 'finance-2', 'finance-2', 'finance', now())`,
      );
      const [{ id: second }] = await tx.execute<{ id: string }>(
        sql`select id from sources where org_id = ${ORG.startup} and slug = 'finance-2'`,
      );
      const { sourceIds } = await effectiveAgent(INSTALLATION.startupFundingPrecheck);
      expect(sourceIds).toEqual([SOURCE.usg.rulebook, SOURCE.startup.finance, second]);
    }));
});

describe.skipIf(!probe)('effectiveAgent · tracks and versions', () => {
  /** A v2 of Club handoff with its own purpose, and the template's latest moved to it. */
  const publishHandoffV2 = (tx: Tx) =>
    tx
      .execute(
        sql`insert into agent_template_versions
              (template_id, version, purpose, audience, usable_by, max_tier, source_kinds, tools,
               model_classes, default_model_class, system_prompt, changelog, published_at, created_at)
            select template_id, 2, 'Second version.', audience, usable_by, max_tier, source_kinds, tools,
                   model_classes, default_model_class, system_prompt, 'v2', published_at, created_at
            from agent_template_versions where template_id = ${TEMPLATE.handoff} and version = 1`,
      )
      .then(() => tx.execute(sql`update agent_templates set latest_version = 2 where id = ${TEMPLATE.handoff}`));

  it('follows the latest version on the latest track', () =>
    inRolledBackApp(async (tx) => {
      await publishHandoffV2(tx);
      const agent = await effectiveAgent(INSTALLATION.startupHandoff);
      expect(agent.templateVersion).toBe(2);
      expect(agent.purpose).toBe('Second version.');
    }));

  it('keeps a pinned installation on its version while the template moves on', () =>
    inRolledBackApp(async (tx) => {
      await publishHandoffV2(tx);
      await tx.execute(
        sql`update agent_installations set track = 'pinned', pinned_version = 1 where id = ${INSTALLATION.startupHandoff}`,
      );
      const agent = await effectiveAgent(INSTALLATION.startupHandoff);
      expect(agent.templateVersion).toBe(1);
      expect(agent.purpose).not.toBe('Second version.');
      const listed = (await myAgents(USER.casey))[0].agents.find((a) => a.templateSlug === 'handoff');
      expect(listed?.templateVersion).toBe(1);
    }));

  // A template whose latest_version names a version that was never published (or a pin to one)
  // cannot be composed. It is skipped from every list with a warning, never dropped silently, and
  // asking for it by id says it does not exist.
  it('skips an unpublished version from lists and refuses it by id', () =>
    inRolledBackApp(async (tx) => {
      const warn = quiet();
      try {
        await tx.execute(sql`update agent_templates set latest_version = 3 where id = ${TEMPLATE.handoff}`);
        await expect(effectiveAgent(INSTALLATION.startupHandoff)).rejects.toMatchObject({
          error: { code: 'not_found' },
        });
        const slugs = (await loadAgents({})).map((l) => l.agent.templateSlug);
        expect(slugs).not.toContain('handoff');
        expect(slugs).toContain('funding-precheck');
        expect((await myAgents(USER.casey))[0].agents).toEqual([]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('is not published'));
      } finally {
        warn.mockRestore();
      }
    }));

  it('skips a pin to an unpublished version the same way', () =>
    inRolledBackApp(async (tx) => {
      const warn = quiet();
      try {
        await tx.execute(
          sql`update agent_installations set track = 'pinned', pinned_version = 9 where id = ${INSTALLATION.startupHandoff}`,
        );
        await expect(effectiveAgent(INSTALLATION.startupHandoff)).rejects.toMatchObject({
          error: { code: 'not_found' },
        });
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('pins version 9'));
      } finally {
        warn.mockRestore();
      }
    }));
});

describe.skipIf(!probe)('effectiveAgent · the latest published rule pack (§8, D6)', () => {
  const addPack = (tx: Tx, version: number, status: 'draft' | 'published', label: string) =>
    tx.execute(
      sql`insert into rule_packs (slug, version, status, label, content, published_at, created_at)
          values ('usg-funding', ${version}, ${status}, ${label}, '{}'::jsonb, ${status === 'published' ? sql`now()` : null}, now())`,
    );

  it('ignores a draft newer than the published pack', () =>
    inRolledBackApp(async (tx) => {
      await addPack(tx, 2, 'draft', 'Draft v2');
      const pack = (await effectiveAgent(INSTALLATION.startupFundingPrecheck)).rulePack;
      expect(pack?.version).toBe(1);
      expect(pack?.label).not.toBe('Draft v2');
    }));

  it('takes effect for every installation the moment v2 is published, even over a later draft', () =>
    inRolledBackApp(async (tx) => {
      await addPack(tx, 2, 'published', 'Published v2');
      await addPack(tx, 3, 'draft', 'Draft v3');
      for (const id of [INSTALLATION.startupFundingPrecheck, INSTALLATION.archeryFundingPrecheck]) {
        const pack = (await effectiveAgent(id)).rulePack;
        expect(pack).toMatchObject({ slug: 'usg-funding', version: 2, label: 'Published v2' });
      }
    }));
});

describe.skipIf(!probe)('retired templates · reported, not offered', () => {
  it('is reported as retired by effectiveAgent, for the gateway to refuse', () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(sql`update agent_templates set status = 'retired' where id = ${TEMPLATE.handoff}`);
      expect((await effectiveAgent(INSTALLATION.startupHandoff)).status).toBe('retired');
    }));

  it("is left out of a member's agents, and of nobody else's", () =>
    inRolledBackApp(async (tx) => {
      await tx.execute(sql`update agent_templates set status = 'retired' where id = ${TEMPLATE.handoff}`);
      const [casey] = await myAgents(USER.casey);
      expect(casey.agents).toEqual([]);
      const [taylor] = await myAgents(USER.taylor);
      expect(taylor.agents.map((a) => a.templateSlug)).toEqual(['funding-precheck']);
    }));
});

describe.skipIf(!probe)('run-time clamp · a version narrowed under an installation (I7)', () => {
  /** Writes past the clamps the way a pre-narrowing row would sit: handoff is members-only, and
   * the installation says public. */
  const widenHandoff = (tx: Tx) =>
    tx.execute(sql`update agent_installations set audience = 'public' where id = ${INSTALLATION.startupHandoff}`);

  const auditCount = async (tx: Tx) => {
    const [{ n }] = await tx.execute<{ n: number }>(
      sql`select count(*)::int as n from audit_events where installation_id = ${INSTALLATION.startupHandoff}
          or target_id = ${INSTALLATION.startupHandoff}`,
    );
    return n;
  };

  // Any signed-in user reaches this read (the gateway composes the agent before the audience check),
  // so it audits nothing and says nothing about the club's sources or positions.
  it('throws a sanitised clamp_violation by id and writes no audit row', () =>
    inRolledBackApp(async (tx) => {
      const warn = quiet();
      try {
        const before = await auditCount(tx);
        await widenHandoff(tx);
        const err = await effectiveAgent(INSTALLATION.startupHandoff).catch((e) => e);
        expect(err).toBeInstanceOf(AppError);
        expect(err.error.code).toBe('clamp_violation');
        expect(err.error).not.toHaveProperty('cap');
        expect(JSON.stringify(err.error)).not.toMatch(/audience|members|positions|src-/);
        expect(await auditCount(tx)).toBe(before);
      } finally {
        warn.mockRestore();
      }
    }));

  it('keeps the campus-wide lists working, skipping only that row', () =>
    inRolledBackApp(async (tx) => {
      const warn = quiet();
      try {
        await widenHandoff(tx);
        expect((await directory()).map((a) => a.templateSlug)).toContain('showcase-qa');
        const [startup] = await myAgents(USER.taylor);
        expect(startup.agents.map((a) => a.templateSlug)).toEqual(['funding-precheck']);
        expect(warn).toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    }));
});
