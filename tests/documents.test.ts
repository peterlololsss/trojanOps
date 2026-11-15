// Owner: C (WP-8). explainAccess (§10) and listAccessibleDocuments under RLS, as trojanops_app.
// The DB suite needs a seeded database (pnpm db:reset) and is skipped when it is unreachable.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { capGrants, grantsFor } from '@/lib/authz';
import type { AccessCell, Actor, EffectiveAgent, Grant, Tier } from '@/lib/contracts';
import { pgTextArray } from '@/lib/db/with-actor';
import { effectiveAgent } from '@/lib/distribution';
import { explainAccess, listAccessibleDocuments, type AccessDocument } from '@/lib/documents/access';
import { FIXTURE_DOCUMENTS } from '@/lib/documents/fixtures';
import { DOCUMENT, INSTALLATION, ORG, POSITION, SOURCE, USER } from '@db/seed/ids';
import { appSql, closeAppDb, rolledBack } from './db';

const sql = await appSql();
afterAll(async () => {
  await sql?.end();
  if (sql) await closeAppDb();   // listAccessibleDocuments opens the app's getDb() pool
});

describe('explainAccess', () => {
  it('explainAccess checks in §10 order', () => {
    const agent = { sourceIds: [SOURCE.startup.public, SOURCE.startup.minutes], maxTier: 'members' as const };
    const member = ['*', `${ORG.startup}:*`] as const;
    expect(explainAccess([...member], agent, { sourceId: SOURCE.startup.finance, tier: 'public', readGrants: ['*'] })).toBe('outside_sources');
    expect(explainAccess([...member], agent, { sourceId: SOURCE.startup.minutes, tier: 'officers', readGrants: [`${ORG.startup}:president`] })).toBe('above_max_tier');
    expect(explainAccess(['*'], agent, { sourceId: SOURCE.startup.minutes, tier: 'members', readGrants: [`${ORG.startup}:*`] })).toBe('not_granted');
    expect(explainAccess([...member], agent, { sourceId: SOURCE.startup.minutes, tier: 'members', readGrants: [`${ORG.startup}:*`] })).toBe('allowed');
  });

  it('reports the first failing check when several fail', () => {
    const agent = { sourceIds: [SOURCE.startup.public, SOURCE.startup.minutes], maxTier: 'members' as const };
    const officersOnly = { tier: 'officers' as const, readGrants: [`${ORG.startup}:president`] };
    expect(explainAccess(['*'], agent, { ...officersOnly, sourceId: SOURCE.startup.finance })).toBe('outside_sources');
    expect(explainAccess(['*'], agent, { ...officersOnly, sourceId: SOURCE.startup.minutes })).toBe('above_max_tier');
  });
});

type SeededDocument = AccessDocument & { id: string; orgId: string; sourceName: string; title: string; bodyMd: string };

const ORGS = Object.keys(ORG) as Array<keyof typeof ORG>;
const EVERY_GRANT: Grant[] = ['*', ...ORGS.flatMap((org): Grant[] => [
  `${ORG[org]}:*`,
  ...Object.keys(POSITION[org]).map((slug): Grant => `${ORG[org]}:${slug}`),
])];
const EVERY_SOURCE: string[] = ORGS.flatMap((org) => Object.values(SOURCE[org]));
const student: Actor = { userId: USER.lee, activeOrgId: null, positions: [], grants: ['*'] };

/** What a run by this user through this agent can read, built the way gateway steps 3 and 5 do. */
async function runScope(userId: string, agent: EffectiveAgent) {
  const userGrants = await grantsFor(userId, agent.orgId);
  const runGrants = capGrants(userGrants, agent.orgId, agent.maxTier);
  const actor: Actor = { userId, activeOrgId: agent.orgId, positions: [], grants: userGrants };
  const readable = new Set((await listAccessibleDocuments(actor, runGrants, agent.sourceIds)).map((d) => d.id));
  return { userGrants, readable };
}

// As in src/lib/runtime/mock.ts, which quotes a document's first sentence as its citation.
const firstSentence = (text: string) => (text.match(/^.*?[.!?](\s|$)/)?.[0] ?? text).trim();

describe.skipIf(!sql)('listAccessibleDocuments under RLS', () => {
  const db = sql!;
  let seeded: SeededDocument[] = [];

  // Every document's metadata, read as trojanops_app holding every grant over every source.
  beforeAll(async () => {
    await rolledBack(db, async (tx) => {
      await tx`select set_config('app.grants', ${pgTextArray(EVERY_GRANT)}, true),
                      set_config('app.agent_sources', ${pgTextArray(EVERY_SOURCE)}, true)`;
      const rows = await tx`select d.id, d.org_id, d.source_id, s.name as source_name, d.title, d.tier, d.read_grants, d.body_md
                            from documents d join sources s on s.id = d.source_id`;
      seeded = rows.map((r) => ({
        id: r.id as string, orgId: r.org_id as string, sourceId: r.source_id as string, sourceName: r.source_name as string,
        title: r.title as string, tier: r.tier as Tier, readGrants: r.read_grants as string[], bodyMd: r.body_md as string,
      }));
    });
    expect(seeded.map((d) => d.id), 'seed documents are missing: run pnpm db:reset')
      .toEqual(expect.arrayContaining(Object.values(DOCUMENT)));
  });

  /** Cells where explainAccess and RLS disagree, for every persona × seeded document through this agent. */
  async function disagreements(label: string, agent: EffectiveAgent, seen: Set<AccessCell>): Promise<string[]> {
    const out: string[] = [];
    for (const user of Object.keys(USER) as Array<keyof typeof USER>) {
      const { userGrants, readable } = await runScope(USER[user], agent);
      for (const doc of seeded) {
        const cell = explainAccess(userGrants, agent, doc);
        seen.add(cell);
        if ((cell === 'allowed') !== readable.has(doc.id)) {
          out.push(`${user} · ${label} · ${doc.title}: explainAccess=${cell}, readable=${readable.has(doc.id)}`);
        }
      }
    }
    return out;
  }

  it('agrees with explainAccess for every persona × agent × document in the seed', async () => {
    const seen = new Set<AccessCell>();
    const mismatches: string[] = [];
    for (const key of Object.keys(INSTALLATION) as Array<keyof typeof INSTALLATION>) {
      mismatches.push(...await disagreements(key, await effectiveAgent(INSTALLATION[key]), seen));
    }
    // No seeded installation has a source holding documents above its max tier, so the cap is
    // exercised by a shape the seed lacks: handoff limited to members, finance source still in.
    const handoff = await effectiveAgent(INSTALLATION.startupHandoff);
    mismatches.push(...await disagreements('startupHandoff at members tier', { ...handoff, maxTier: 'members' }, seen));
    expect(mismatches).toEqual([]);
    expect([...seen]).toEqual(expect.arrayContaining(['allowed', 'not_granted', 'outside_sources', 'above_max_tier']));
  }, 20_000);   // 64 transactions

  // TODO(verify): capGrants(…, 'officers') keeps every grant, so an officers-tier agent over the
  // usg_internal source lets USG admins and reviewers read Reviewer notes while explainAccess says
  // above_max_tier. Reported to stream A. This turns red once they agree; then make it a plain it().
  it.fails('agrees for an officers-tier agent over the usg_internal source (known gap)', async () => {
    const review = await effectiveAgent(INSTALLATION.usgReviewAssistant);
    expect(await disagreements('usgReviewAssistant at officers tier', { ...review, maxTier: 'officers' }, new Set())).toEqual([]);
  });

  // listLibraryDocuments and previewAccess still read fixtures.ts, so B's and D's pages must show the
  // same documents that runs read. Delete this test together with fixtures.ts.
  it('matches the fixtures behind the library and preview stubs', () => {
    const project = (d: SeededDocument) => ({
      id: d.id, orgId: d.orgId, sourceId: d.sourceId, sourceName: d.sourceName, title: d.title, tier: d.tier,
      readGrants: [...d.readGrants].sort(), opening: firstSentence(d.bodyMd),
    });
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    const ids = new Set(FIXTURE_DOCUMENTS.map((d) => d.id));
    expect(seeded.filter((d) => ids.has(d.id)).map(project).sort(byId))
      .toEqual(FIXTURE_DOCUMENTS.map(project).sort(byId));
  });

  // §10 visibility contract. Columns: Recruiting FAQ, Minutes, Spring budget, USG funding rules.
  const columns = [DOCUMENT.recruitingFaq, DOCUMENT.minutes20261008, DOCUMENT.spring2026Budget, DOCUMENT.usgFundingRules];
  const yes = true;
  const no = false;
  const contract: Array<{ who: string; userId: string; installationId: string; reads: boolean[] }> = [
    { who: 'Lee (no club) · recruiting-qa', userId: USER.lee, installationId: INSTALLATION.startupRecruitingQa, reads: [yes, no, no, no] },
    { who: 'Taylor (treasurer) · recruiting-qa', userId: USER.taylor, installationId: INSTALLATION.startupRecruitingQa, reads: [yes, no, no, no] },
    { who: 'Casey (member) · handoff', userId: USER.casey, installationId: INSTALLATION.startupHandoff, reads: [yes, yes, no, no] },
    { who: 'Taylor (treasurer) · handoff', userId: USER.taylor, installationId: INSTALLATION.startupHandoff, reads: [yes, yes, yes, no] },
    { who: 'Morgan (Archery treasurer, Startup member) · handoff', userId: USER.morgan, installationId: INSTALLATION.startupHandoff, reads: [yes, yes, no, no] },
    { who: 'Taylor (treasurer) · funding-precheck', userId: USER.taylor, installationId: INSTALLATION.startupFundingPrecheck, reads: [no, no, yes, yes] },
  ];
  for (const row of contract) {
    it(`§10 visibility: ${row.who}`, async () => {
      const { readable } = await runScope(row.userId, await effectiveAgent(row.installationId));
      expect(columns.map((id) => readable.has(id))).toEqual(row.reads);
    });
  }

  it('returns exactly id, title, tier and bodyMd', async () => {
    const docs = await listAccessibleDocuments(student, EVERY_GRANT, EVERY_SOURCE);
    expect(docs.map((d) => d.id).sort()).toEqual(seeded.map((d) => d.id).sort());
    for (const doc of docs) expect(Object.keys(doc).sort()).toEqual(['bodyMd', 'id', 'tier', 'title']);
  });

  it('returns nothing without sources or without grants', async () => {
    expect(await listAccessibleDocuments(student, EVERY_GRANT, [])).toEqual([]);
    expect(await listAccessibleDocuments(student, [], EVERY_SOURCE)).toEqual([]);
  });
});
