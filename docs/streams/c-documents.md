# Stream C: Documents and permissions

## Chat and knowledge delivery, 2026-11-15

Delivered the shared Dify-style chat window, safe Markdown/citations with current access checks,
model prices and real allowance/reset context, playback/Stop, private in-memory transcript,
older-run inspection and human-confirmation cards. Knowledge library, restricted document detail,
inherited chunks, Text/Access views, demo indexing, president-only retrieval tests and upload
access review use the existing RLS and access services. No real retrieval or model calls were added.

**Owner:** TBD. You own what can be read and how that is shown: the document library, the access
query behind every run, the permission preview, the run page with its inspector, and the audit
views. Your paths are in `AGENTS.md`.

## Work packages

| WP | Hours | Done when (full text: `docs/architecture.md` §16) |
|---|---|---|
| WP-8 | H2–6 | Upload (president only), `listAccessibleDocuments` (real by H5), `explainAccess` with a test that it agrees with RLS |
| WP-9 | H6–11 | Run page with inspector and pending actions, preview matrix, club and USG audit views; D4, D8 |
| WP-14 | H12–16 | Retrieval, tools and verified citations on the real runtime; `funding-precheck` checks against the USG Funding Department Guidelines |

## You provide

Stubs by H3.

| Interface | Real by |
|---|---|
| `listAccessibleDocuments()`, `explainAccess()` | H5 |
| `listLibraryDocuments()` | H6 |
| `previewAccess()`, `<Inspector />`, `listBlockedDocuments()` (A wires it into gateway step 8) | H10 |
| `<RunWorkspace />`: the run page's transcript, pending actions and inspector, for D's directory run page | H11 |

## You consume

- A: `withActor` (real H5), `gateway.runAgent` (stub H3, real H9), `audit()`.
- B: `effectiveAgent` (real H6).

## Demo beats

- D4: preview, with My agents from D.
- D8: audit with "Restricted document".
- The inspector in every run beat.

## Watch for

- Never show a title the viewer can't read. Preview columns are the documents the viewer can read
  plus the USG rulebook.
- "Blocked by rule" appears only for the club president or a USG admin.
- Uploads go through `documents.library` with `app.manage_org`; code never writes `read_grants`
  (the trigger does).
- Club views read `agent_runs_meta`, never run input or output.

## First prompt

> Read `AGENTS.md`, `docs/architecture.md` §5, §10 and §16, and `docs/streams/c-documents.md`.
> Plan WP-8: upload, `listAccessibleDocuments`, `explainAccess`, and the agreement test against the
> §10 contract. Edit only stream C paths. Show me the plan first.
