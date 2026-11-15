# Document library page

The page at `/org/[orgId]/documents` shows the documents the viewer can read in a club, with search, a
tier filter and pagination, and a president-only upload form. It backs the permissions story (what a
person can read in a club) rather than a numbered demo beat.

- `getLibraryPageData` (`src/lib/documents/library-page.ts`) loads club metadata and calls
  `listLibraryDocuments`, so only documents the viewer can read reach the page.
- `viewLibrary` (`src/lib/documents/library-view.ts`) is the pure search, tier filter and pagination
  function the table uses.
- The table is TanStack Table (`@tanstack/react-table` v9) rendered by `data-table.tsx`, a
  presentational component with no document knowledge.
- Only the president of the active club receives upload sources and officer-position choices. Upload
  uses the existing JSON API with Markdown entered as text; a successful upload refreshes the
  authorized library instead of inserting the response into the table.

## Demo check

Start `pnpm dev`, choose a persona at `/`, then open
`/org/00000010-0000-4000-8000-000000000002/documents` (Startup Club).

| Persona / action | Expected result on the seeded database |
|---|---|
| Signed out | Sign-in link; no document table |
| Sam | Six readable documents; upload form with four Startup sources |
| Casey | FAQ, minutes, past events and USG funding rules; no budget/contact titles or upload form |
| Morgan, with Archery active | Startup member documents; no Startup budget or Archery documents |
| Lee | Recruiting FAQ and public USG funding rules only |
| Search for an absent title, then Clear filters | Zero-result message, then the readable list returns |
| Filter by tier | Count and rows reflect only matching readable documents |
| Sam: choose Officers | Checkboxes for secretary and treasurer only; the president always has access; unchecked means president only |
| Change tier away from Officers and back | Previous officer selections are cleared |
| Sam: upload title, source, tier and Markdown text | Pending status, then success and refreshed library |
| Submit after session changes to Casey | API denial; entered title and text remain |
| Submit while the API is unreachable | Inline error; entered title and text remain |
| API returns an object, array, number or blank message, or a non-JSON error | Status-based error message; form stays usable and entered text remains |
| Narrow viewport | Table scrolls horizontally |

An actual successful upload creates a document and audit event. Use a disposable demo database
for that check. Automated service upload tests run in rollback transactions. The seed has fewer than
11 readable documents per club, so paging is covered by `tests/documents-library-view.test.ts`.

## Owner requests

- Stream D: promote `src/app/org/[orgId]/documents/data-table.tsx` to `src/components/ui` as the shared
  Data Table. It takes a TanStack `table` instance plus `caption`, `numericColumns`, `monoColumns`,
  `rowHeaderColumn`, `sorted`, `empty` and `minWidth`. C will switch its import once it lands. The
  design brief also calls for skeleton rows, a bulk-action bar and a row-action menu, which it does not
  have yet.
