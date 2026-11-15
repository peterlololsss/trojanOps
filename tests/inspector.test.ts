// Owner: C (WP-9). listBlockedDocuments (RunInspector.blocked, §7 step 8) under RLS as trojanops_app,
// and the <Inspector /> markup. The DB suite needs a seeded database (pnpm db:reset) and is skipped
// when it is unreachable.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, describe, expect, it } from 'vitest';
import { Inspector } from '@/components/inspector';
import { capGrants, grantsFor } from '@/lib/authz';
import { now } from '@/lib/clock';
import type { Actor, RunInspector } from '@/lib/contracts';
import { documents, memberships } from '@/lib/db/schema';
import { withActor } from '@/lib/db/with-actor';
import { effectiveAgent } from '@/lib/distribution';
import { explainAccess, listAccessibleDocuments, listBlockedDocuments } from '@/lib/documents/access';
import { uploadDocument } from '@/lib/documents/library';
import { DOCUMENT, INSTALLATION, ORG, POSITION, SOURCE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const sql = await appSql();
afterAll(async () => { await sql?.end(); if (sql) await closeAppDb(); });

const EVERY_SOURCE = (Object.keys(SOURCE) as Array<keyof typeof SOURCE>).flatMap((org) => Object.values(SOURCE[org]));
const ORG_KEY = Object.fromEntries(Object.entries(ORG).map(([key, id]) => [id, key])) as Record<string, keyof typeof ORG>;

/** One run's blocked list, with grants and accessible documents built the way gateway steps 3 and 5 do. */
async function blockedFor(viewer: Actor, installationId: string) {
  const agent = await effectiveAgent(installationId);
  const runGrants = capGrants(await grantsFor(viewer.userId, agent.orgId), agent.orgId, agent.maxTier);
  const accessible = (await listAccessibleDocuments(viewer, runGrants, agent)).map((doc) => doc.id);
  const blocked = await listBlockedDocuments(viewer, agent, runGrants, accessible);
  return { agent, runGrants, accessible, blocked };
}

const byId = <T extends { id: string }>(rows: T[] | undefined) => [...(rows ?? [])].sort((a, b) => a.id.localeCompare(b.id));
const outside = (...ids: string[]) => byId(ids.map((id) => ({ id, reason: 'outside_sources' })));
const shape = (rows: Array<{ id: string; reason: string }> | undefined) => byId(rows).map(({ id, reason }) => ({ id, reason }));

describe.skipIf(!sql)('listBlockedDocuments under RLS', () => {
  it('returns undefined for anyone who is not the club president or a USG admin', async () => {
    const cases: Array<[string, string | null, string]> = [
      [USER.casey, ORG.startup, INSTALLATION.startupHandoff],
      [USER.taylor, ORG.startup, INSTALLATION.startupFundingPrecheck],
      [USER.jordan, ORG.startup, INSTALLATION.startupHandoff],
      [USER.morgan, ORG.archery, INSTALLATION.archeryFundingPrecheck],
      [USER.lee, null, INSTALLATION.startupRecruitingQa],
      [USER.riley, ORG.usg, INSTALLATION.usgReviewAssistant],
      [USER.sam, ORG.startup, INSTALLATION.archeryFundingPrecheck],
    ];
    for (const [userId, orgId, installationId] of cases) {
      expect((await blockedFor(await actorFor(userId, orgId), installationId)).blocked).toBeUndefined();
    }
  });

  it('recomputes presidential authority when the membership ends', async () => {
    await inRolledBackApp(async (tx) => {
      const sam = await actorFor(USER.sam, ORG.startup);
      await tx.update(memberships).set({ endedAt: now() }).where(eq(memberships.userId, USER.sam));
      expect((await blockedFor(sam, INSTALLATION.startupHandoff)).blocked).toBeUndefined();
    });
  });

  it('lists what each Startup agent could not read for its president', async () => {
    const sam = await actorFor(USER.sam, ORG.startup);
    expect(shape((await blockedFor(sam, INSTALLATION.startupRecruitingQa)).blocked)).toEqual(outside(
      DOCUMENT.minutes20261008, DOCUMENT.pastEvents, DOCUMENT.spring2026Budget, DOCUMENT.sponsorContacts, DOCUMENT.usgFundingRules,
    ));
    expect(shape((await blockedFor(sam, INSTALLATION.startupHandoff)).blocked)).toEqual(outside(DOCUMENT.usgFundingRules));
    expect(shape((await blockedFor(sam, INSTALLATION.startupFundingPrecheck)).blocked)).toEqual(outside(
      DOCUMENT.recruitingFaq, DOCUMENT.minutes20261008, DOCUMENT.pastEvents,
    ));
    const handoff = await blockedFor(sam, INSTALLATION.startupHandoff);
    expect(handoff.blocked).toEqual([{ id: DOCUMENT.usgFundingRules, title: 'USG Funding Department Guidelines', reason: 'outside_sources' }]);
  });

  it('gives a USG admin a list, empty when the run read everything in scope', async () => {
    const avery = await actorFor(USER.avery, ORG.usg);
    expect((await blockedFor(avery, INSTALLATION.usgReviewAssistant)).blocked).toEqual([]);
    // Avery holds no Startup membership: only public documents are candidates.
    expect(shape((await blockedFor(avery, INSTALLATION.startupFundingPrecheck)).blocked)).toEqual(outside(DOCUMENT.recruitingFaq));
  });

  it('reports above_max_tier for a members document in a public agent’s source', async () => {
    await inRolledBackApp(async () => {
      const sam = await actorFor(USER.sam, ORG.startup);
      const uploaded = await uploadDocument(sam, ORG.startup, {
        sourceId: SOURCE.startup.public, title: 'Members-only recruiting notes', tier: 'members', allowedPositions: [], bodyMd: 'Members only.',
      });
      const { blocked, accessible } = await blockedFor(sam, INSTALLATION.startupRecruitingQa);
      expect(accessible).not.toContain(uploaded.id);
      expect(blocked).toContainEqual({ id: uploaded.id, title: 'Members-only recruiting notes', reason: 'above_max_tier' });
    });
  });

  it('keeps ids but hides titles the president cannot read in the active club', async () => {
    await inRolledBackApp(async (tx) => {
      // Sam also joins Dance and runs Startup's public agent from there (§7 step 1 allows it).
      await tx.insert(memberships).values({
        id: randomUUID(), userId: USER.sam, orgId: ORG.dance, positionId: POSITION.dance.member,
        source: 'manual', startedAt: now(), createdAt: now(),
      });
      const sam = await actorFor(USER.sam, ORG.dance);
      const { blocked } = await blockedFor(sam, INSTALLATION.startupRecruitingQa);
      expect(byId(blocked)).toEqual(byId([
        { id: DOCUMENT.minutes20261008, title: null, reason: 'outside_sources' },
        { id: DOCUMENT.pastEvents, title: null, reason: 'outside_sources' },
        { id: DOCUMENT.spring2026Budget, title: null, reason: 'outside_sources' },
        { id: DOCUMENT.sponsorContacts, title: null, reason: 'outside_sources' },
        { id: DOCUMENT.usgFundingRules, title: 'USG Funding Department Guidelines', reason: 'outside_sources' },
      ]));
      expect(blocked?.at(-1)?.title).toBeNull();   // readable titles first
      expect(JSON.stringify(blocked)).not.toMatch(/Meeting minutes|Spring 2026 budget|Sponsor contacts|Past events/);
    });
  });

  it('never shows a document the viewer cannot read, and returns only id, title and reason', async () => {
    await inRolledBackApp(async () => {
      const sam = await actorFor(USER.sam, ORG.startup);
      const hiddenId = randomUUID();
      await withActor(sam, {}, (tx) => tx.insert(documents).values({
        id: hiddenId, orgId: ORG.startup, sourceId: SOURCE.startup.finance,
        title: 'Hidden inspector sentinel', tier: 'usg_internal', bodyMd: 'Hidden text.', createdAt: now(),
      }));
      for (const installationId of [INSTALLATION.startupHandoff, INSTALLATION.startupFundingPrecheck, INSTALLATION.startupRecruitingQa]) {
        const { blocked } = await blockedFor(sam, installationId);
        expect(blocked?.map((doc) => doc.id)).not.toContain(hiddenId);
        expect(JSON.stringify(blocked)).not.toMatch(/Hidden inspector sentinel|Hidden text|readGrants|bodyMd/);
        for (const doc of blocked ?? []) expect(Object.keys(doc).sort()).toEqual(['id', 'reason', 'title']);
      }
    });
  });

  it('agrees with RLS for every viewer × installation in the seed', async () => {
    const viewers = [
      [USER.sam, ORG.startup], [USER.avery, ORG.usg], [USER.taylor, ORG.startup], [USER.morgan, ORG.archery], [USER.lee, null],
    ] as const;
    const mismatches: string[] = [];
    for (const [userId, orgId] of viewers) {
      const viewer = await actorFor(userId, orgId);
      for (const [key, installationId] of Object.entries(INSTALLATION)) {
        const { agent, runGrants, accessible, blocked } = await blockedFor(viewer, installationId);
        const label = `${viewer.userId} · ${key}`;
        const manager = (viewer.userId === USER.sam && [ORG.startup, ORG.hacksc].some((id) => id === agent.orgId)) || viewer.userId === USER.avery;
        if (!manager) {
          if (blocked !== undefined) mismatches.push(`${label}: not a manager but got a list`);
          continue;
        }
        if (!blocked) { mismatches.push(`${label}: manager but got undefined`); continue; }

        // Candidates, read independently: everything the viewer's memberships in the club can read
        // over the club's sources, the USG rulebook and the agent's sources.
        const scope = new Set<string>([...Object.values(SOURCE[ORG_KEY[agent.orgId]]), SOURCE.usg.rulebook, ...agent.sourceIds]);
        const clubGrants = await grantsFor(viewer.userId, agent.orgId);
        const candidates = await readable(viewer, { grants: clubGrants, sourceIds: EVERY_SOURCE });
        const own = new Map((await readable(viewer, { sourceIds: EVERY_SOURCE })).map((doc) => [doc.id, doc.title]));
        const expected = candidates.filter((doc) => scope.has(doc.sourceId) && !accessible.includes(doc.id));

        const got = new Map(blocked.map((doc) => [doc.id, doc]));
        if (got.size !== expected.length) mismatches.push(`${label}: ${got.size} blocked, expected ${expected.length}`);
        for (const doc of expected) {
          const row = got.get(doc.id);
          const reason = explainAccess(runGrants, agent, doc);
          if (!row) mismatches.push(`${label} · ${doc.title}: missing`);
          else if (row.reason !== reason || reason === 'allowed') mismatches.push(`${label} · ${doc.title}: reason ${row.reason}, rule ${reason}`);
          else if (row.title !== (own.get(doc.id) ?? null)) mismatches.push(`${label} · ${doc.title}: title ${row.title}`);
        }
        for (const id of accessible) if (got.has(id)) mismatches.push(`${label}: ${id} is both read and blocked`);
      }
    }
    expect(mismatches).toEqual([]);
  }, 30_000);
});

describe('<Inspector />', () => {
  const base: RunInspector = {
    runGrants: [{ grant: '*', label: 'Any signed-in student' }, { grant: `${ORG.startup}:treasurer`, label: 'Startup Club · Treasurer' }],
    sources: [{ id: SOURCE.startup.finance, name: 'Startup Club · Finance' }],
    permitted: [{ id: DOCUMENT.spring2026Budget, title: 'Spring 2026 budget', tier: 'officers' }],
    readInRun: [{ id: DOCUMENT.spring2026Budget, title: 'Spring 2026 budget' }],
    templateVersion: 1,
    rulePack: { label: 'USG Funding Guidelines 2026–27', version: 1 },
    billedClub: 'Startup Club',
    costMicro: 10_000,
    quotaRemainingMicro: { 'Startup Club': 4_990_000 },
    auditEventId: 1042,
  };
  const render = (inspector: RunInspector) => renderToStaticMarkup(createElement(Inspector, { inspector }));

  it('renders the six sections in order with labels, never raw grants', () => {
    const html = render(base);
    expect([...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]))
      .toEqual(['Run grants', 'Sources', 'Documents', 'Versions', 'Billing', 'Audit']);
    expect(html).not.toMatch(/demo runtime|Earlier messages/i);
    expect(html).toContain('Startup Club · Treasurer');
    expect(html).not.toContain(ORG.startup);
    expect(html).toContain('Officers');
    expect(html).toContain('Template v1');
    expect(html).toContain('USG Funding Guidelines 2026–27 v1');
    expect(html).toContain('$0.01');
    expect(html).toContain('Quota left · Startup Club');
    expect(html).toContain('$4.99');
    expect(html).toContain('#1042');
  });

  it('hides Blocked by rule unless the viewer manages the club', () => {
    expect(render(base)).not.toContain('Blocked by rule');
    const empty = render({ ...base, blocked: [] });
    expect(empty).toContain('Blocked by rule');
    expect(empty).toContain('Nothing blocked for this run.');
  });

  it('shows Restricted document for a null title, with the reason as icon and word', () => {
    const html = render({ ...base, blocked: [
      { id: DOCUMENT.usgFundingRules, title: 'USG Funding Department Guidelines', reason: 'outside_sources' },
      { id: DOCUMENT.minutes20261008, title: null, reason: 'above_max_tier' },
    ] });
    expect(html).toContain('USG Funding Department Guidelines');
    expect(html).toContain('Outside agent sources');
    expect(html).toContain('Restricted document');
    expect(html).toContain('Above agent max tier');
    expect(html).not.toContain(DOCUMENT.minutes20261008);
  });

  it('states empty document lists', () => {
    const html = render({ ...base, permitted: [], readInRun: [] });
    expect(html).toContain('This run could read no documents.');
    expect(html).toContain('No documents cited in this run.');
  });
});

/** Document metadata the viewer reads under the given RLS scope (I1: inside withActor). */
function readable(viewer: Actor, scope: { grants?: Actor['grants']; sourceIds: string[] }) {
  return withActor(viewer, scope, (tx) => tx.select({
    id: documents.id, title: documents.title, tier: documents.tier, sourceId: documents.sourceId, readGrants: documents.readGrants,
  }).from(documents));
}
