// Owner: C (WP-8). explainAccess (§10) and listAccessibleDocuments under RLS, as trojanops_app.
// The DB suite needs a seeded database (pnpm db:reset) and is skipped when it is unreachable.
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET, POST } from '@/app/api/orgs/[orgId]/documents/route';
import { capGrants, grantsFor } from '@/lib/authz';
import type { AccessCell, Actor, ApiError, EffectiveAgent, Grant, LibraryDocument, Tier } from '@/lib/contracts';
import { documents } from '@/lib/db/schema';
import { pgTextArray, withActor } from '@/lib/db/with-actor';
import { effectiveAgent } from '@/lib/distribution';
import { explainAccess, listAccessibleDocuments, type AccessDocument } from '@/lib/documents/access';
import { FIXTURE_DOCUMENTS } from '@/lib/documents/fixtures';
import { listLibraryDocuments, uploadDocument, type UploadDocumentInput } from '@/lib/documents/library';
import { listAudit } from '@/lib/gateway/audit';
import { ACTIVE_ORG_COOKIE, PERSONA_COOKIE } from '@/lib/identity';
import { DOCUMENT, INSTALLATION, ORG, POSITION, SOURCE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp, rolledBack } from './db';

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

  // previewAccess still reads fixtures.ts, so the preview page must show the same documents that
  // runs read. Delete this test together with fixtures.ts.
  it('matches the fixtures behind the preview stub', () => {
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

// Every case runs inside inRolledBackApp: trojanops_app has no DELETE, so nothing may be committed.
describe.skipIf(!sql)('library and upload', () => {
  const db = sql!;
  const ids = (docs: Array<{ id: string }>) => docs.map((d) => d.id).sort();
  const sorted = (values: string[]) => [...values].sort();

  /** Every document id, read with every grant over every source. */
  const allDocumentIds = async () => ids(await withActor(student, { grants: EVERY_GRANT, sourceIds: EVERY_SOURCE },
    (tx) => tx.select({ id: documents.id }).from(documents)));
  // Counted as Avery (USG admin), who keeps seeing every club's upload rows once listAudit scopes by viewer.
  const uploadCount = async () =>
    (await listAudit(await actorFor(USER.avery, ORG.usg), { action: 'document.upload', limit: 10_000 })).length;

  const casey = [DOCUMENT.recruitingFaq, DOCUMENT.minutes20261008, DOCUMENT.pastEvents, DOCUMENT.usgFundingRules];
  const visibility: Array<{ who: string; userId: string; activeOrg: string | null; library: string; sees: string[] }> = [
    { who: 'Casey (member) · startup', userId: USER.casey, activeOrg: ORG.startup, library: ORG.startup, sees: casey },
    { who: 'Sam (president) · startup', userId: USER.sam, activeOrg: ORG.startup, library: ORG.startup,
      sees: [...casey, DOCUMENT.spring2026Budget, DOCUMENT.sponsorContacts] },
    { who: 'Lee (no club) · startup', userId: USER.lee, activeOrg: null, library: ORG.startup,
      sees: [DOCUMENT.recruitingFaq, DOCUMENT.usgFundingRules] },
    // Grants come from Morgan's Startup membership, not from the active org (Archery treasurer).
    { who: 'Morgan (active in Archery) · startup', userId: USER.morgan, activeOrg: ORG.archery, library: ORG.startup, sees: casey },
    { who: 'Avery (USG admin) · usg', userId: USER.avery, activeOrg: ORG.usg, library: ORG.usg,
      sees: [DOCUMENT.usgFundingRules, DOCUMENT.reviewerNotes] },
  ];
  for (const row of visibility) {
    it(`library visibility: ${row.who}`, async () => {
      await inRolledBackApp(async () => {
        const docs = await listLibraryDocuments(await actorFor(row.userId, row.activeOrg), row.library);
        expect(ids(docs)).toEqual(sorted(row.sees));
      });
    });
  }

  it('returns exactly the LibraryDocument fields, newest first then by title, with names from sources', async () => {
    await inRolledBackApp(async () => {
      const docs = await listLibraryDocuments(await actorFor(USER.sam, ORG.startup), ORG.startup);
      for (const doc of docs) {
        expect(Object.keys(doc).sort()).toEqual(['createdAt', 'id', 'sourceId', 'sourceName', 'tier', 'title', 'version']);
        expect(doc.createdAt).toBeInstanceOf(Date);
      }
      const order = (a: LibraryDocument, b: LibraryDocument) =>
        b.createdAt.getTime() - a.createdAt.getTime() || (a.title < b.title ? -1 : a.title > b.title ? 1 : 0);
      expect(docs.map((d) => d.id)).toEqual([...docs].sort(order).map((d) => d.id));
      const name = (id: string) => docs.find((d) => d.id === id)?.sourceName;
      expect(name(DOCUMENT.recruitingFaq)).toBe('Startup Club · Public');
      expect(name(DOCUMENT.spring2026Budget)).toBe('Startup Club · Finance');
      expect(name(DOCUMENT.usgFundingRules)).toBe('USG rulebook');
    });
  });

  it('returns nothing for an org id that is not a uuid', async () => {
    await inRolledBackApp(async () => {
      expect(await listLibraryDocuments(await actorFor(USER.sam, ORG.startup), 'startup')).toEqual([]);
    });
  });

  const officersUpload: UploadDocumentInput = {
    sourceId: SOURCE.startup.finance, title: 'Secretary handbook (test)', tier: 'officers',
    allowedPositions: ['secretary'], bodyMd: 'Only the president and the secretary read this.',
  };

  it('lets the president upload; the trigger computes read_grants and the upload is audited', async () => {
    await inRolledBackApp(async () => {
      const sam = await actorFor(USER.sam, ORG.startup);
      const doc = await uploadDocument(sam, ORG.startup, officersUpload);
      expect(doc).toEqual({
        id: expect.any(String), title: officersUpload.title, tier: 'officers', sourceId: SOURCE.startup.finance,
        sourceName: 'Startup Club · Finance', version: 1, createdAt: expect.any(Date),
      });

      expect(ids(await listLibraryDocuments(sam, ORG.startup))).toContain(doc.id);
      expect(ids(await listLibraryDocuments(await actorFor(USER.taylor, ORG.startup), ORG.startup))).not.toContain(doc.id);
      expect(ids(await listLibraryDocuments(await actorFor(USER.casey, ORG.startup), ORG.startup))).not.toContain(doc.id);

      const [row] = await withActor(student, { grants: EVERY_GRANT, sourceIds: EVERY_SOURCE },
        (tx) => tx.select({ readGrants: documents.readGrants, uploadedBy: documents.uploadedBy })
          .from(documents).where(eq(documents.id, doc.id)));
      expect(sorted(row.readGrants)).toEqual(sorted([`${ORG.startup}:president`, `${ORG.startup}:secretary`]));
      expect(row.uploadedBy).toBe(USER.sam);

      const [entry] = await listAudit(sam, { action: 'document.upload', limit: 1 });
      expect(entry).toMatchObject({ targetType: 'document', targetId: doc.id, actingOrgId: ORG.startup, actorUserId: USER.sam });
      expect(JSON.stringify(entry.details)).not.toContain(officersUpload.title);
      expect(JSON.stringify(entry.details)).not.toContain(officersUpload.bodyMd);
    });
  });

  const refusals: Array<{ why: string; userId: string | null; activeOrg: string | null; orgId: string; input: Partial<UploadDocumentInput>; code: ApiError['code'] }> = [
    { why: 'signed out', userId: null, activeOrg: null, orgId: ORG.startup, input: {}, code: 'unauthenticated' },
    { why: 'Taylor is not the president', userId: USER.taylor, activeOrg: ORG.startup, orgId: ORG.startup, input: {}, code: 'forbidden' },
    { why: 'Sam, active in Startup, uploads to Archery', userId: USER.sam, activeOrg: ORG.startup, orgId: ORG.archery,
      input: { sourceId: SOURCE.archery.finance }, code: 'forbidden' },
    { why: 'the source belongs to another club', userId: USER.sam, activeOrg: ORG.startup, orgId: ORG.startup,
      input: { sourceId: SOURCE.archery.finance }, code: 'invalid' },
    { why: 'usg_internal outside USG', userId: USER.sam, activeOrg: ORG.startup, orgId: ORG.startup,
      input: { tier: 'usg_internal', allowedPositions: [] }, code: 'invalid' },
    { why: 'positions on a members document', userId: USER.sam, activeOrg: ORG.startup, orgId: ORG.startup,
      input: { tier: 'members', allowedPositions: ['treasurer'] }, code: 'invalid' },
    { why: 'a position the club does not have', userId: USER.sam, activeOrg: ORG.startup, orgId: ORG.startup,
      input: { allowedPositions: ['vice_president'] }, code: 'invalid' },
    { why: 'a non-officer position on an officers document', userId: USER.sam, activeOrg: ORG.startup, orgId: ORG.startup,
      input: { tier: 'officers', allowedPositions: ['member'] }, code: 'invalid' },
  ];
  for (const r of refusals) {
    it(`refuses an upload: ${r.why} (${r.code})`, async () => {
      await inRolledBackApp(async () => {
        const actor: Actor = r.userId ? await actorFor(r.userId, r.activeOrg) : { userId: null, activeOrgId: null, positions: [], grants: [] };
        const before = { docs: await allDocumentIds(), audits: await uploadCount() };
        await expect(uploadDocument(actor, r.orgId, { ...officersUpload, ...r.input }))
          .rejects.toMatchObject({ name: 'AppError', error: { code: r.code } });
        expect(await allDocumentIds()).toEqual(before.docs);
        expect(await uploadCount()).toBe(before.audits);
      });
    });
  }

  const cookieFor = (userId: string, orgId: string) => `${PERSONA_COOKIE}=${userId}; ${ACTIVE_ORG_COOKIE}=${orgId}`;
  const url = `http://localhost/api/orgs/${ORG.startup}/documents`;
  const ctx = () => ({ params: Promise.resolve({ orgId: ORG.startup }) });
  const post = (cookie: string, body: string, contentType = 'application/json') =>
    POST(new Request(url, { method: 'POST', headers: { cookie, 'content-type': contentType }, body }), ctx());

  it('GET /api/orgs/[orgId]/documents: the library for a persona, 401 when signed out', async () => {
    await inRolledBackApp(async () => {
      const ok = await GET(new Request(url, { headers: { cookie: cookieFor(USER.casey, ORG.startup) } }), ctx());
      expect(ok.status).toBe(200);
      expect(ids(await ok.json() as LibraryDocument[])).toEqual(sorted(casey));
      const signedOut = await GET(new Request(url), ctx());
      expect(signedOut.status).toBe(401);
    });
  });

  it('POST /api/orgs/[orgId]/documents: 200 for the president, 403 for a member, 400 for a non-JSON body', async () => {
    await inRolledBackApp(async () => {
      const ok = await post(cookieFor(USER.sam, ORG.startup), JSON.stringify(officersUpload));
      expect(ok.status).toBe(200);
      expect(await ok.json()).toMatchObject({ title: officersUpload.title, tier: 'officers', version: 1 });
      expect((await post(cookieFor(USER.casey, ORG.startup), JSON.stringify(officersUpload))).status).toBe(403);
      expect((await post(cookieFor(USER.sam, ORG.startup), 'title=x', 'text/plain')).status).toBe(400);
      expect((await post(cookieFor(USER.sam, ORG.startup), JSON.stringify({ ...officersUpload, title: '' }))).status).toBe(400);
    });
  });

  // Runs last in this file: proves the cases above committed nothing.
  it('leaves exactly the seeded documents behind', async () => {
    let committed: string[] = [];
    await rolledBack(db, async (tx) => {
      await tx`select set_config('app.grants', ${pgTextArray(EVERY_GRANT)}, true),
                      set_config('app.agent_sources', ${pgTextArray(EVERY_SOURCE)}, true)`;
      committed = (await tx`select id from documents`).map((r) => r.id as string).sort();
    });
    expect(committed).toEqual(sorted(Object.values(DOCUMENT)));
  });
});
