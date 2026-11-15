import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import { capGrants } from '@/lib/authz';
import { now } from '@/lib/clock';
import type { Actor, Grant } from '@/lib/contracts';
import { documents, memberships, positions, sources } from '@/lib/db/schema';
import { withActor } from '@/lib/db/with-actor';
import { effectiveAgent } from '@/lib/distribution';
import { listAccessibleDocuments } from '@/lib/documents/access';
import { uploadDocument } from '@/lib/documents/library';
import { previewAccess } from '@/lib/documents/preview';
import { getPreviewPageData } from '@/lib/documents/preview-page';
import { ACTIVE_ORG_COOKIE, PERSONA_COOKIE } from '@/lib/identity';
import { DOCUMENT, INSTALLATION, ORG, SOURCE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const sql = await appSql();
afterAll(async () => { await sql?.end(); if (sql) await closeAppDb(); });

describe.skipIf(!sql)('permission preview', () => {
  it('requires sign-in before resolving an installation', async () => {
    const viewer: Actor = { userId: null, activeOrgId: null, positions: [], grants: [] };
    await expect(previewAccess(viewer, INSTALLATION.startupHandoff)).rejects.toMatchObject({ status: 401 });
  });

  it('rejects members and a president viewing another club', async () => {
    await expect(previewAccess(await actorFor(USER.casey, ORG.startup), INSTALLATION.startupHandoff))
      .rejects.toMatchObject({ status: 403 });
    await expect(previewAccess(await actorFor(USER.sam, ORG.startup), INSTALLATION.archeryFundingPrecheck))
      .rejects.toMatchObject({ status: 403 });
  });

  it('recomputes presidential authority when membership ends', async () => {
    await inRolledBackApp(async (tx) => {
      const sam = await actorFor(USER.sam, ORG.startup);
      await tx.update(memberships).set({ endedAt: now() }).where(eq(memberships.userId, USER.sam));
      await expect(previewAccess(sam, INSTALLATION.startupHandoff)).rejects.toMatchObject({ status: 403 });
    });
  });

  it('shows only readable club documents and the public rulebook', async () => {
    const matrix = await previewAccess(await actorFor(USER.sam, ORG.startup), INSTALLATION.startupHandoff);
    expect(matrix.documents.map((doc) => doc.id).sort()).toEqual([
      DOCUMENT.recruitingFaq, DOCUMENT.minutes20261008, DOCUMENT.pastEvents,
      DOCUMENT.spring2026Budget, DOCUMENT.sponsorContacts, DOCUMENT.usgFundingRules,
    ].sort());
    expect(matrix.cells.member[DOCUMENT.minutes20261008]).toBe('allowed');
    expect(matrix.cells.member[DOCUMENT.spring2026Budget]).toBe('not_granted');
    expect(matrix.cells.treasurer[DOCUMENT.spring2026Budget]).toBe('allowed');
    expect(Object.keys(matrix).sort()).toEqual(['cells', 'documents', 'subjects']);
  });

  it('previews a disabled public agent without exposing additional sources', async () => {
    const matrix = await previewAccess(await actorFor(USER.sam, ORG.startup), INSTALLATION.startupRecruitingQa);
    expect(matrix.cells.student[DOCUMENT.recruitingFaq]).toBe('allowed');
    expect(matrix.cells.student[DOCUMENT.minutes20261008]).toBe('outside_sources');
  });

  it('reads newly uploaded documents and updated position/source labels', async () => {
    await inRolledBackApp(async (tx) => {
      const sam = await actorFor(USER.sam, ORG.startup);
      const uploaded = await uploadDocument(sam, ORG.startup, {
        sourceId: SOURCE.startup.finance, title: 'Secretary handoff', tier: 'officers',
        allowedPositions: ['secretary'], bodyMd: 'Secretary-only notes.',
      });
      await tx.update(positions).set({ name: 'Club secretary' })
        .where(and(eq(positions.orgId, ORG.startup), eq(positions.slug, 'secretary')));
      await tx.update(sources).set({ name: 'Current finance source' }).where(eq(sources.id, SOURCE.startup.finance));
      const matrix = await previewAccess(sam, INSTALLATION.startupHandoff);
      expect(matrix.documents.find((doc) => doc.id === uploaded.id)).toMatchObject({ title: 'Secretary handoff', source: 'Current finance source' });
      expect(matrix.subjects.find((subject) => subject.key === 'secretary')?.label).toBe('Club secretary');
      expect(matrix.cells.secretary[uploaded.id]).toBe('allowed');
      expect(matrix.cells.treasurer[uploaded.id]).toBe('not_granted');
    });
  });

  it('omits unreadable titles even inside the managed club', async () => {
    await inRolledBackApp(async () => {
      const sam = await actorFor(USER.sam, ORG.startup);
      const hiddenId = randomUUID();
      await withActor(sam, {}, (tx) => tx.insert(documents).values({
        id: hiddenId, orgId: ORG.startup, sourceId: SOURCE.startup.finance,
        title: 'Hidden preview sentinel', tier: 'usg_internal', bodyMd: 'Hidden text.', createdAt: now(),
      }));
      const matrix = await previewAccess(sam, INSTALLATION.startupHandoff);
      expect(matrix.documents.map((doc) => doc.id)).not.toContain(hiddenId);
      expect(JSON.stringify(matrix)).not.toContain('Hidden preview sentinel');
    });
  });

  it('keeps the signed-in student row separate from a position named student', async () => {
    await inRolledBackApp(async (tx) => {
      await tx.insert(positions).values({ orgId: ORG.startup, slug: 'student', name: 'Student liaison', isOfficer: true, createdAt: now() });
      const matrix = await previewAccess(await actorFor(USER.sam, ORG.startup), INSTALLATION.startupHandoff);
      expect(matrix.subjects.find((subject) => subject.key === 'student')?.label).toBe('Any signed-in student');
      expect(matrix.subjects.find((subject) => subject.key === 'position:student')?.label).toBe('Student liaison');
      expect(matrix.cells.student[DOCUMENT.minutes20261008]).toBe('not_granted');
      expect(matrix.cells['position:student'][DOCUMENT.minutes20261008]).toBe('allowed');
    });
  });

  it('loads installed agent choices with a selected matrix and no prompt or grants payload', async () => {
    const page = await getPreviewPageData(await actorFor(USER.sam, ORG.startup), ORG.startup, INSTALLATION.startupHandoff);
    expect(page?.org.name).toBe('Startup Club');
    expect(page?.selectedAgent).toEqual({ id: INSTALLATION.startupHandoff, name: 'Club handoff', maxTier: 'officers' });
    expect(page?.agents.find((agent) => agent.id === INSTALLATION.startupRecruitingQa)?.status).toBe('disabled');
    expect(page?.matrix?.cells.member[DOCUMENT.spring2026Budget]).toBe('not_granted');
    expect(JSON.stringify(page)).not.toMatch(/systemPrompt|readGrants|bodyMd/);
  });

  it('rejects unauthorized page loads and foreign selections, and distinguishes missing clubs', async () => {
    const sam = await actorFor(USER.sam, ORG.startup);
    expect(await getPreviewPageData(sam, 'invalid')).toBeNull();
    expect(await getPreviewPageData(sam, randomUUID())).toBeNull();
    await expect(getPreviewPageData(sam, ORG.startup, INSTALLATION.archeryFundingPrecheck)).rejects.toMatchObject({ status: 404 });
    await expect(getPreviewPageData(await actorFor(USER.casey, ORG.startup), ORG.startup)).rejects.toMatchObject({ status: 403 });
  });

  it('agrees with RLS for every subject and document through the club agents', async () => {
    const sam = await actorFor(USER.sam, ORG.startup);
    for (const id of [INSTALLATION.startupHandoff, INSTALLATION.startupRecruitingQa, INSTALLATION.startupFundingPrecheck]) {
      const agent = await effectiveAgent(id);
      const matrix = await previewAccess(sam, id);
      for (const subject of matrix.subjects) {
        const grants: Grant[] = subject.key === 'student' ? ['*'] : ['*', `${ORG.startup}:*`];
        if (!['student', 'member'].includes(subject.key)) grants.push(`${ORG.startup}:${subject.key}`);
        const readable = new Set((await listAccessibleDocuments(sam, capGrants(grants, ORG.startup, agent.maxTier), agent)).map((doc) => doc.id));
        for (const doc of matrix.documents) expect(matrix.cells[subject.key][doc.id] === 'allowed').toBe(readable.has(doc.id));
      }
    }
  });

  it('enforces the org route and rejects missing installation parameters', async () => {
    const { GET } = await import('@/app/api/orgs/[orgId]/preview/route');
    const cookie = `${PERSONA_COOKIE}=${USER.sam}; ${ACTIVE_ORG_COOKIE}=${ORG.startup}`;
    const request = (orgId: string, installation?: string, authenticated = true) => GET(
      new Request(`http://localhost/api/orgs/${orgId}/preview${installation ? `?installation=${installation}` : ''}`,
        { headers: authenticated ? { cookie } : {} }), { params: Promise.resolve({ orgId }) },
    );
    const ok = await request(ORG.startup, INSTALLATION.startupHandoff);
    expect(ok.status).toBe(200);
    expect((await ok.json()).cells.member[DOCUMENT.spring2026Budget]).toBe('not_granted');
    expect((await request(ORG.startup)).status).toBe(400);
    expect((await request(ORG.archery, INSTALLATION.startupHandoff)).status).toBe(404);
    expect((await request(ORG.startup, 'invalid')).status).toBe(404);
    expect((await request(ORG.startup, INSTALLATION.startupHandoff, false)).status).toBe(401);
  });
});
