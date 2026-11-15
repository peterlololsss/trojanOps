# WP-8 slice 3: document library page

Branch: `c/wp8-library-page`, synchronized with `origin/main` through PR #11 (`96a99e8`). The
draft includes the shared document-tier contract, isolated test sources and real gateway audit writer.

The page at `/org/[orgId]/documents` uses `getLibraryPageData` to load club metadata and
`listLibraryDocuments` to load only the documents the viewer can read. Only the president of the
active club receives upload sources and officer-position choices. Upload uses the existing JSON
API; Markdown is entered as text. Successful uploads refresh the authorized library rather than
inserting the response into the table.

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
| Sam: choose Officers | Officer checkboxes; president always has access; unchecked means president only |
| Change tier away from Officers and back | Previous officer selections are cleared |
| Sam: upload title, source, tier and Markdown text | Pending status, then success and refreshed library |
| Submit after session changes to Casey | API denial; entered title and text remain |
| Submit while the API is unreachable | Inline error; entered title and text remain |
| API returns an object, array, number or blank message, or a non-JSON error | Status-based error message; form stays usable and entered text remains |
| Narrow viewport | Table scrolls horizontally |

An actual successful upload creates a document and audit event. Use a disposable demo database
for that check. Automated service upload tests run in rollback transactions.

## Validation and owner requests

- Seven new authentication/database tests pass in `tests/documents-page.test.ts`.
- Nine Chrome interaction scenarios pass without browser exceptions. These include a real API
  denial, simulated network failure and simulated upload success; the browser checks create no documents.
- Typecheck, lint, invariant greps and design greps pass. Reviewer found no must-fix issue.
- With the upload error fix, a fresh isolated `pnpm db:reset` and `pnpm check` pass with
  138 tests in nine files, including all database suites. The existing local database was not reset.
- The upload error parsing finding is fixed: JSON is treated as `unknown`, and only a nonblank
  string `message` is rendered. Invalid JSON, empty responses and malformed messages use the
  status-based fallback. Fourteen regression tests and eight new Chrome response scenarios pass;
  browser checks preserve entered text and create no documents.
- The shared-table finding remains open. Latest fetched `origin/main` still provides only
  `src/components/ui/button.tsx` and has no TanStack dependency. Stream D must provide the shared
  shadcn/TanStack table and its import/props interface; Stream A must add the dependency in a
  separate `deps` PR. Stream C can then replace the document table while retaining readable-only
  rows, search/tier filters, pagination, timestamps, tier labels and empty states.
- Keep this PR in draft until the shared-table finding is resolved. `AGENTS.md` rule 1 assigns
  shared UI to D and root dependency files to A; this slice does not change those paths.
- Google Fonts were unreachable during browser verification, so the shared shell used fallback fonts.
