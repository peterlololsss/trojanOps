import { afterAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/lib/contracts';
import { getLibraryPageData } from '@/lib/documents/library-page';
import { DOCUMENT, ORG, SOURCE, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb } from './db';

const signedOut: Actor = { userId: null, activeOrgId: null, positions: [], grants: [] };
const sql = await appSql();
afterAll(async () => {
  await sql?.end();
  if (sql) await closeAppDb();
});

describe('document library page authentication', () => {
  it('rejects signed-out reads before loading page data', async () => {
    await expect(getLibraryPageData(signedOut, ORG.startup)).rejects.toMatchObject({ status: 401 });
  });
});

describe.skipIf(!sql)('document library page data', () => {
  it('gives the president only this club’s upload sources and officer positions', async () => {
    const page = await getLibraryPageData(await actorFor(USER.sam, ORG.startup), ORG.startup);
    expect(page?.org).toEqual({ id: ORG.startup, name: 'Startup Club', kind: 'rso' });
    expect(page?.canUpload).toBe(true);
    expect(page?.sources.map((source) => source.id).sort()).toEqual(Object.values(SOURCE.startup).sort());
    expect(page?.positions.map((position) => position.slug).sort()).toEqual(['president', 'secretary', 'treasurer']);
    expect(page?.documents.map((document) => document.id)).toContain(DOCUMENT.spring2026Budget);
    expect(page?.documents.map((document) => document.id)).not.toContain(DOCUMENT.reviewerNotes);
  });

  it('keeps restricted titles and upload controls out of a member’s page data', async () => {
    const page = await getLibraryPageData(await actorFor(USER.casey, ORG.startup), ORG.startup);
    expect(page?.documents.map((document) => document.id).sort()).toEqual([
      DOCUMENT.recruitingFaq, DOCUMENT.minutes20261008, DOCUMENT.pastEvents, DOCUMENT.usgFundingRules,
    ].sort());
    expect(page?.canUpload).toBe(false);
    expect(page?.sources).toEqual([]);
    expect(page?.positions).toEqual([]);
    expect(JSON.stringify(page)).not.toContain('Spring 2026 budget');
  });

  it('shows only public documents to a student outside the club', async () => {
    const page = await getLibraryPageData(await actorFor(USER.lee, null), ORG.startup);
    expect(page?.documents.map((document) => document.id).sort()).toEqual([
      DOCUMENT.recruitingFaq, DOCUMENT.usgFundingRules,
    ].sort());
    expect(page?.canUpload).toBe(false);
  });

  it('uses viewed-club membership without carrying officer access from the active club', async () => {
    const actor = await actorFor(USER.morgan, ORG.archery);
    const page = await getLibraryPageData(actor, ORG.startup);
    expect(page?.documents.map((document) => document.id)).toContain(DOCUMENT.minutes20261008);
    expect(page?.documents.map((document) => document.id)).not.toContain(DOCUMENT.spring2026Budget);
    expect(page?.canUpload).toBe(false);
    expect(page?.sources).toEqual([]);
  });

  it('does not offer upload in another club to the active club’s president', async () => {
    const page = await getLibraryPageData(await actorFor(USER.sam, ORG.startup), ORG.archery);
    expect(page?.canUpload).toBe(false);
    expect(page?.sources).toEqual([]);
    expect(page?.positions).toEqual([]);
  });

  it('distinguishes malformed and missing clubs from an empty library', async () => {
    const actor = await actorFor(USER.sam, ORG.startup);
    expect(await getLibraryPageData(actor, 'invalid')).toBeNull();
    expect(await getLibraryPageData(actor, '10000000-0000-4000-8000-ffffffffffff')).toBeNull();
  });
});
