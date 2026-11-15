import { describe, expect, it } from 'vitest';
import type { LibraryDocument, Tier } from '@/lib/contracts';
import {
  changeFilter, formatPacific, initialQuery, PAGE_SIZE, tierOptions, viewLibrary,
} from '@/lib/documents/library-view';

function doc(n: number, tier: Tier = 'members', sourceName = 'Club files'): LibraryDocument {
  return {
    id: `doc-${n}`, title: `Document ${n}`, tier, sourceId: 'src', sourceName, version: 1,
    createdAt: new Date(Date.UTC(2026, 10, 1, 12, n)),
  };
}
const many = Array.from({ length: 25 }, (_, i) => doc(i + 1));

describe('library view: pagination', () => {
  it('returns the first page with the page size and counts', () => {
    const view = viewLibrary(many, initialQuery);
    expect(view.rows.map((d) => d.id)).toEqual(many.slice(0, PAGE_SIZE).map((d) => d.id));
    expect(view).toMatchObject({ matching: 25, total: 25, page: 0, pageCount: 3, filtered: false, empty: null });
  });

  it('returns a short last page', () => {
    const view = viewLibrary(many, { ...initialQuery, page: 2 });
    expect(view.rows).toHaveLength(5);
    expect(view.page).toBe(2);
  });

  it('clamps a page past the end and a negative or fractional page', () => {
    expect(viewLibrary(many, { ...initialQuery, page: 99 }).page).toBe(2);
    expect(viewLibrary(many, { ...initialQuery, page: -4 }).page).toBe(0);
    expect(viewLibrary(many, { ...initialQuery, page: Number.NaN }).page).toBe(0);
    expect(viewLibrary(many, { ...initialQuery, page: 1.9 }).page).toBe(1);
  });

  it('has one empty page for an empty library', () => {
    expect(viewLibrary([], { ...initialQuery, page: 3 })).toMatchObject({ page: 0, pageCount: 1, rows: [] });
  });

  it('keeps the input order', () => {
    const view = viewLibrary([doc(3), doc(1), doc(2)], initialQuery);
    expect(view.rows.map((d) => d.id)).toEqual(['doc-3', 'doc-1', 'doc-2']);
  });
});

describe('library view: filters', () => {
  const docs = [
    doc(1, 'public', 'USG rulebook'), doc(2, 'members', 'Club files'),
    doc(3, 'officers', 'Club files'), doc(4, 'members', 'Meeting minutes'),
  ];

  it('searches title and source name, case-insensitive and trimmed', () => {
    expect(viewLibrary(docs, { ...initialQuery, search: '  RULEBOOK ' }).rows.map((d) => d.id)).toEqual(['doc-1']);
    expect(viewLibrary(docs, { ...initialQuery, search: 'document 2' }).rows.map((d) => d.id)).toEqual(['doc-2']);
  });

  it('filters by tier and combines with search', () => {
    expect(viewLibrary(docs, { ...initialQuery, tier: 'members' }).matching).toBe(2);
    const both = viewLibrary(docs, { search: 'minutes', tier: 'members', page: 0 });
    expect(both.rows.map((d) => d.id)).toEqual(['doc-4']);
    expect(both.filtered).toBe(true);
  });

  it('reports no-results when filters exclude everything but documents exist', () => {
    const view = viewLibrary(docs, { ...initialQuery, search: 'absent title' });
    expect(view).toMatchObject({ rows: [], matching: 0, total: 4, empty: 'no-results', filtered: true });
  });

  it('reports nothing-yet when the viewer can read no documents, with or without filters', () => {
    expect(viewLibrary([], initialQuery).empty).toBe('nothing-yet');
    expect(viewLibrary([], { ...initialQuery, search: 'x' }).empty).toBe('nothing-yet');
  });

  it('treats a blank search as no filter', () => {
    expect(viewLibrary(docs, { ...initialQuery, search: '   ' })).toMatchObject({ matching: 4, filtered: false });
  });

  it('clamps the page after filters shrink the result', () => {
    const view = viewLibrary(many, { search: 'Document 2', tier: '', page: 2 });
    expect(view.matching).toBe(7);
    expect(view.page).toBe(0);
  });
});

describe('library view: changing filters', () => {
  it('resets to the first page and keeps the other filter', () => {
    const next = changeFilter({ search: 'a', tier: 'public', page: 4 }, { search: 'b' });
    expect(next).toEqual({ search: 'b', tier: 'public', page: 0 });
    expect(changeFilter({ search: 'a', tier: 'public', page: 4 }, { tier: '' })).toEqual({ search: 'a', tier: '', page: 0 });
  });

  it('clears both filters', () => {
    expect(changeFilter({ search: 'a', tier: 'public', page: 4 }, { search: '', tier: '' })).toEqual(initialQuery);
  });
});

describe('library view: tier options', () => {
  it('offers USG internal only in the USG org', () => {
    expect(tierOptions('rso').map((o) => o.value)).toEqual(['public', 'members', 'officers']);
    expect(tierOptions('usg').map((o) => o.value)).toEqual(['public', 'members', 'officers', 'usg_internal']);
  });
});

describe('library view: timestamps', () => {
  it('formats Pacific time with a generic PT suffix', () => {
    expect(formatPacific(new Date('2026-11-15T18:42:00Z'))).toBe('Nov 15, 2026, 10:42 AM PT');
  });

  it('follows daylight time and uses PT in both seasons', () => {
    expect(formatPacific(new Date('2026-07-04T19:05:00Z'))).toBe('Jul 4, 2026, 12:05 PM PT');
  });
});
