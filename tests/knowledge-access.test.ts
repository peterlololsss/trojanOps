import { afterAll, describe, expect, it } from 'vitest';
import { testRetrieval } from '@/lib/documents/retrieval-test';
import { getKnowledgeLibrary } from '@/lib/documents/knowledge-library';
import { getDocumentPageData } from '@/lib/documents/document-page';
import { DOCUMENT, INSTALLATION, ORG, USER } from '@db/seed/ids';
import { actorFor, appSql, closeAppDb, inRolledBackApp } from './db';

const probe = await appSql();
await probe?.end();
afterAll(async () => { if (probe) await closeAppDb(); });

describe.skipIf(!probe)('knowledge permissions with the real database', () => {
  it('keeps officer chunks out for Member and retrieves them for Treasurer', () => inRolledBackApp(async () => {
    const sam = await actorFor(USER.sam, ORG.startup);
    const input = { installationId: INSTALLATION.startupHandoff, question: 'catering budget', subject: 'member', topK: 3, scoreThreshold: 0.3 };
    const member = await testRetrieval(sam, ORG.startup, input);
    expect(member.hits.some((h) => h.documentId === DOCUMENT.spring2026Budget)).toBe(false);
    expect(member.keptOut.find((h) => h.documentId === DOCUMENT.spring2026Budget)?.reason).toBe('not_granted');
    const treasurer = await testRetrieval(sam, ORG.startup, { ...input, subject: 'treasurer' });
    expect(treasurer.hits[0].documentId).toBe(DOCUMENT.spring2026Budget);
    expect(treasurer.hits[0].score).toBe(1);
    expect(treasurer.byPosition.find((p) => p.key === 'treasurer')?.count).toBe(8);
  }));
  it('refuses a non-president before exposing retrieval candidates', async () => {
    await expect(testRetrieval(await actorFor(USER.casey, ORG.startup), ORG.startup, { installationId: INSTALLATION.startupHandoff, question: 'budget', subject: 'member', topK: 3, scoreThreshold: 0.3 })).rejects.toMatchObject({ status: 403 });
  });
  it('gives a nonmember only readable documents and public-agent metadata', async () => {
    const data = await getKnowledgeLibrary(await actorFor(USER.lee, null), ORG.startup);
    expect(data?.documents.every((d) => d.tier === 'public')).toBe(true);
    expect(JSON.stringify(data)).not.toContain('Spring 2026 budget');
    expect(data?.canSeeCited).toBe(false);
  });
  it('makes unreadable and nonexistent documents indistinguishable', async () => {
    const lee = await actorFor(USER.lee, null);
    const restricted = await getDocumentPageData(lee, ORG.startup, DOCUMENT.spring2026Budget);
    const missing = await getDocumentPageData(lee, ORG.startup, '00000000-0000-4000-8000-000000000000');
    expect(restricted).toEqual(missing);
    expect(restricted?.document).toBeNull();
  });
  it('shows exact inherited chunks to an authorized officer', async () => {
    const data = await getDocumentPageData(await actorFor(USER.taylor, ORG.startup), ORG.startup, DOCUMENT.spring2026Budget);
    expect(data?.document?.tier).toBe('officers');
    expect(data?.chunks[0].text).toContain('$6,200');
    expect(data?.document?.whoCanRead).toBe('Treasurer, President');
  });
});
