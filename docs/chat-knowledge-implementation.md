# Desktop chat, credits and knowledge delivery

2026-11-15. The user's final scope is desktop only. Acceptance widths are 1440 and 1920 pixels;
phone work and phone captures are excluded from this delivery. Work stays on `main`.

## Delivered

- A bounded Dify-style chat window: user messages on the right, AI answers on the left, explicit
  speaker labels, a bottom composer and an independently scrolling inspector. Public directory
  chats use the same workspace, with space reserved for their taller page header.
- Model choice within the template, USG policy and club override. Economy costs 1 credit;
  Standard costs 3. One credit is $0.01. The gateway validates the choice before holding quota.
- Real balance, reset dates, low-credit guidance, quota refusals and a private Usage page with
  actual run metadata and the viewer's own blocked attempts. No fabricated usage values.
- Safe Markdown, numbered citation buttons, current-access checks, quote previews, copying,
  finished-run playback, Stop, Show full answer, retry, New conversation and old-run inspection.
- Human confirmation for the funding submission proposal. Confirmation records the decision;
  no queue executor or real agent was introduced.
- Documents with access audiences, index states, chunks, usable-agent counts and manager-only
  citation counts. Readable document detail includes Chunks, Text and president-only Access.
- President-only retrieval tests with real access decisions, deterministic word-overlap scores,
  Top K, score threshold, kept-out explanations and in-memory test history.
- Upload through a Sheet: Details, server-side access review, then the existing upload API.
  Returning to Details preserves the text and officer selections.
- Administration with dollar/credit amounts, zero-allowance confirmation and member model
  controls. The existing USG Clubs page now shows prices, platform and daily allowances, credit
  equivalents and affected agents before a restrictive model-policy change.

## Contracts, privacy and demo boundaries

The additive run request field is `modelClass?` on `POST /api/agents/:installationId/runs`.
`src/lib/contracts.ts`, database schema and migrations are unchanged by this slice. Local view
models expose bounded model metadata; retired catalog entries deliberately expose no model choices.

Every run still goes through `gateway.runAgent`. The application connects as `trojanops_app`;
document reads remain inside `withActor`, with freshly computed and capped grants. Quota holds,
settlements, access decisions and audit records are real. Manager views never read run input/output.

The runtime is mock: it quotes permitted documents and shows the current rule-pack version.
There are no model calls, embeddings or RAG. Demo chunks and index progress derive from readable
document text and `clock.now()` and are never used by a run. Index errors and processing progress
are labelled as demo behavior. Stop affects playback of an already finished run and does not cancel
its charge. Chat state is component memory only; it is never sent as history or written to browser
storage, and is cleared on navigation, persona change or New conversation.

## Verification

`pnpm check` runs typecheck, lint, unit and real database integration tests, invariant checks and
design checks. The final log is `.omo/evidence/chat-final-check.log`. The isolated PostgreSQL 17.12
database was reset and seeded before testing; tests use the application role, not the owner.
On this memory-constrained Windows host the command uses
`NODE_OPTIONS=--max-old-space-size=768 --max-semi-space-size=4`. Three existing lint warnings are
in the old untracked WP-11 evidence scripts; no production lint errors remain.

Actual browser acceptance uses a task-owned Chromium profile and the real Next.js server:

- `.omo/evidence/chat-knowledge-shots/qa-results.json`: chat empty/answered, citation, pending,
  failure/retry, older inspector, Usage, human confirmation, library, detail, retrieval, upload,
  Administration, model refusal, zero allowance, public low-credit and blocked states.
- `supplement-results.json` in the same folder: USG budgets, a real daily allowance save, policy
  confirmation/cancel, index error, Text/Access tabs, no-results filtering, Stop/Show full answer
  and New conversation.
- `demo-results.json` in the same folder: the D1-D8 story through real routes and persona sign-in,
  including roster idempotence, rule-pack propagation, succession and private audit views.

Screenshots, viewport/overflow checks, runtime exceptions and the frontend detector findings are
saved with those manifests. The desktop review checks every captured state and transcript end.
The detector's badge-padding and composer-frame warnings are intentional compact badges and a
framed input inside the chat window. Retrieval results deliberately continue below the viewport;
the document owns that scrolling. These are not clipped content or generic decorative cards.
The detected skipped heading and long excerpt measure were corrected in the final implementation.

Useful local commands after opening this checkout:

```powershell
pnpm dev
```

The ignored `.env` is configured for the isolated local database on port 55432. Demo sign-in
accepts `member` / `fighton` for Casey, `treasurer` / `fighton` for Taylor, and `admin` / `fighton`
for Avery. The shared demo password is already documented by the upstream sign-in implementation.
The validation dev server is stopped after acceptance. Local tools, `.env`, screenshots, `.omo/`
and `.pnpm-store/` are not committed.

## Stream review map

| Stream | Commits and main areas |
|---|---|
| A | `913f196`: `gateway/prices`, priced holds, run model validation, quota context, usage/cited metadata and mock answers; gateway tests |
| B | `db95e6c`, `1cfb773`, `bd3d1bd`: bounded classes, funding tool seed, Administration allowances/models, USG price/allowance and policy-effect UI |
| C | `5cf231a`, `ed0ba0a`, `a1312ed`, `3b34079`: chat/inspector, permission-safe knowledge services, chunks, retrieval, upload review and related tests |
| D | `620387c`, `f4b5d9e`: safe Markdown, shared directory workspace, private Usage and navigation |
| Integration | `969527a`, `f5e0c57`: desktop QA corrections; `7319385` preserves the upstream sign-in, USG console and retired-agent safeguards |

The user's `main`-only instruction replaces the attachment's worktree/feature-branch PR workflow.
Review uses these commits on `main`; there is no separate feature branch to open against `main`.

## Optional work left outside the required slice

The citation full-document quick-look Sheet, Sources page, navigation-persistent transcript/History
provider and scripted demo answers remain optional work. Citations already provide permission-aware
quote popovers and Open in document. No real model/retrieval work is included. Mobile acceptance
was explicitly removed by the user.

## Remaining TODO(verify) inventory

The new open decision is whether quota messages should name the president; the implementation
uses the requested role wording in `src/lib/gateway/quota-messages.ts`.

Inherited source markers are retained for their owners:

| File | Open verification |
|---|---|
| `src/lib/identity/index.ts` | Preferred USG admin landing page after the console ships |
| `src/lib/lifecycle/transfer.ts` | Team agreement on single-holder officer succession |
| `src/lib/connectors/roster/mock.ts` | CSV location in a bundled deployment |
| `src/lib/documents/run-page.ts` | Process-wide runtime marker for WP-13; policy on hiding internal agent details from nonmembers |
| `src/lib/gateway/audit.ts` | Acting-club visibility for members' runs billed elsewhere |
| `src/lib/gateway/confirm.ts` | Confirmation policy for nonmembers using public agents |
| `src/lib/documents/audit-view.ts` | Source scope for audit document title resolution |
| `src/lib/distribution/clamps.ts` | Public installation default budget convention |
| `src/lib/gateway/tools.ts` | Per-tool confirmer policy as real write executors are registered |
| `src/lib/gateway/quota.ts` | Member/installation fallback convention with provisioning |
| `src/lib/distribution/provision.ts` | Historical platform-quota fallback during provisioning |
| `src/components/inspector/chip.tsx` | Migration of the existing inspector chip to the shared Badge |
| `src/lib/distribution/queries.ts` | Club-versus-installation quota comment for the owner |

Historical design/research checks for demo prices, seeded-ready indexing, duplicate grant labels,
usage privacy, inline citation buttons and the funding tool seed are covered by the implementation
and tests. Policy tightening now uses the existing service's refusal for incompatible non-retired
installations. Personal president names, template-owned starters and future real-history token
budgets still require their planned team/contract decisions.
