import { describe, expect, it } from 'vitest';
import { demoChunks, demoScore, demoStatus } from '@/lib/documents/fixtures';
import { DOCUMENT } from '@db/seed/ids';

describe('labelled demo index', () => {
  it('keeps exact source offsets while splitting headings and long passages', () => {
    const body = '# Budget\n\nOpening sentence.\n\n## Catering\n\n' + 'A catering item. '.repeat(100);
    const chunks = demoChunks(body);
    expect(chunks[0]).toMatchObject({ n: 1, heading: 'Introduction', text: 'Opening sentence.' });
    expect(chunks[1].heading).toBe('Catering');
    for (const chunk of chunks) {
      expect(body.slice(chunk.start, chunk.start + chunk.chars)).toBe(chunk.text);
      expect(chunk.chars).toBeLessThanOrEqual(800);
      expect(chunk.tokens).toBe(Math.ceil(chunk.chars / 4));
    }
  });
  it('moves uploads through queued, indexing and ready on the supplied clock', () => {
    const bodyMd = 'First sufficiently long paragraph with useful content.\n\n## Timeline\n\nDoors open at six and the event begins at seven.\n\n## Roles\n\nOfficers handle check-in and catering throughout the event.';
    const createdAt = new Date('2026-11-15T18:00:00Z');
    const doc = { id: 'upload', bodyMd, createdAt };
    expect(demoStatus(doc, createdAt)).toEqual({ state: 'queued' });
    expect(demoStatus(doc, new Date(createdAt.getTime() + 5000))).toEqual({ state: 'indexing', done: 1, total: 3 });
    expect(demoStatus(doc, new Date(createdAt.getTime() + 9000))).toEqual({ state: 'ready' });
    expect(demoStatus({ ...doc, id: DOCUMENT.recruitingFaq }, createdAt)).toEqual({ state: 'ready' });
    expect(demoStatus({ ...doc, bodyMd: 'Tiny' }, createdAt).state).toBe('error');
  });
  it('scores distinct meaningful words and folds plurals without using a model', () => {
    expect(demoScore('the catering budgets budget', { heading: 'Budget', text: 'Catering is the largest line.' })).toEqual({ score: 1, matched: ['catering', 'budget'] });
    expect(demoScore('the and a', { heading: 'Budget', text: 'Catering' })).toEqual({ score: 0, matched: [] });
  });
});
