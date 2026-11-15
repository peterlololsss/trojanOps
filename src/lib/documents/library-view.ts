// Owner: C (WP-8). Pure view logic for the library table: search, tier filter and pagination over
// documents the viewer can already read. No I/O, so the page and the tests share one definition.
import type { LibraryDocument, Tier } from '../contracts';

export const PAGE_SIZE = 10;

export const tierLabels: Record<Tier, string> = {
  public: 'Public', members: 'Members', officers: 'Officers', usg_internal: 'USG internal',
};

/** Tiers a club can choose or filter by. "USG internal" exists only in the USG org. */
export function tierOptions(orgKind: 'usg' | 'rso'): Array<{ value: Tier; label: string }> {
  return (Object.entries(tierLabels) as Array<[Tier, string]>)
    .filter(([value]) => value !== 'usg_internal' || orgKind === 'usg')
    .map(([value, label]) => ({ value, label }));
}

export interface LibraryQuery {
  search: string;
  tier: Tier | '';
  /** Zero-based; clamped to the last page by `viewLibrary`. */
  page: number;
}

export const initialQuery: LibraryQuery = { search: '', tier: '', page: 0 };

/** A filter change always returns to the first page; a page change keeps the filters. */
export function changeFilter(query: LibraryQuery, patch: Partial<Pick<LibraryQuery, 'search' | 'tier'>>): LibraryQuery {
  return { ...query, ...patch, page: 0 };
}

export type LibraryEmptyState = 'nothing-yet' | 'no-results' | null;

export interface LibraryView {
  rows: LibraryDocument[];
  /** Documents matching the filters, across all pages. */
  matching: number;
  /** Documents the viewer can read, before filters. */
  total: number;
  page: number;
  pageCount: number;
  filtered: boolean;
  empty: LibraryEmptyState;
}

/** Applies search and the tier filter, keeps the input order, and returns one page. Search
 * normalisation is trim plus toLowerCase; a document matches when its title or its source name
 * contains the needle, each checked on its own, so a needle never matches across the two. An
 * out-of-range page is clamped rather than rejected. */
export function viewLibrary(
  documents: readonly LibraryDocument[],
  query: LibraryQuery,
  pageSize = PAGE_SIZE,
): LibraryView {
  const needle = query.search.trim().toLowerCase();
  const matches = documents.filter((doc) => (!query.tier || doc.tier === query.tier)
    && (!needle || [doc.title, doc.sourceName].some((text) => text.toLowerCase().includes(needle))));
  const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
  const page = Math.min(Math.max(0, Math.trunc(query.page) || 0), pageCount - 1);
  return {
    rows: matches.slice(page * pageSize, (page + 1) * pageSize),
    matching: matches.length,
    total: documents.length,
    page,
    pageCount,
    filtered: needle !== '' || query.tier !== '',
    empty: documents.length === 0 ? 'nothing-yet' : matches.length === 0 ? 'no-results' : null,
  };
}

const pacific = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  hour12: true, timeZone: 'America/Los_Angeles',
});

/** "Nov 15, 2026, 10:42 AM PT": Pacific time with the generic zone name the UI rules ask for. */
export function formatPacific(date: Date): string {
  return `${pacific.format(date).replace(/[  ]/g, ' ')} PT`;
}
