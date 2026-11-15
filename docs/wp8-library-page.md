# WP-8 slice 3: document library page

Branch: `c/wp8-library-page`, synchronized with `origin/main` after PRs #7, #8 and #9 merged
(`0483860`). The draft now includes the shared document-tier contract and isolated test sources.

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
| Narrow viewport | Table scrolls horizontally |

An actual successful upload creates a document and audit event. Use a disposable demo database
for that check. Automated service upload tests run in rollback transactions.

## Validation and owner requests

- Seven new authentication/database tests pass in `tests/documents-page.test.ts`.
- Nine Chrome interaction scenarios pass without browser exceptions. These include a real API
  denial, simulated network failure and simulated upload success; the browser checks create no documents.
- Typecheck, lint, invariant greps and design greps pass. Reviewer found no must-fix issue.
- After synchronizing main, a fresh isolated `pnpm db:reset` and `pnpm check` pass with 115 tests,
  including all database suites. The preceding PRs fixed the source-id collisions and tier mismatch.
- Stream D request: provide the shared shadcn/TanStack table and its dependency. Neither exists
  in this checkout; this slice uses the existing semantic-table pattern without changing dependencies.
- Current code review also requires narrowing the upload error response before rendering its
  `message`. The existing `as ApiError` assertion accepts a non-string message that React cannot render.
- Keep this PR in draft until both review findings are resolved. The new review was static;
  the browser scenarios above are the author's earlier verification.
- Google Fonts were unreachable during browser verification, so the shared shell used fallback fonts.
