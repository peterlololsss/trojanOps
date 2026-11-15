# WP-11 implementation and verification

Historical verification before main `414eb83`. See [post-main integration](d-main-integration.md)
for current dependency status and the fresh combined check.

Stream D's directory, public-agent run page and My agents are implemented against the published
interfaces. Full D3/D4 demo acceptance still requires the owner implementations listed below.

## Slice manifest

All WP-11 product files are new, keeping this slice separate from the uncommitted WP-2/WP-10 work:

- `src/app/directory/{page,directory-list,loading,error}.tsx`: campus directory, search, club and
  purpose filters, result count, empty/no-results, sign-in, loading and retry states.
- `src/app/directory/[installationId]/{page,public-run,loading}.tsx`, `actions.ts`, `run-state.ts`:
  public-agent selection, form boundary, document-style latest-run transcript, source disclosure,
  mock-runtime label and C's imported Inspector.
- `src/app/me/agents/{page,my-agents-list,loading,error}.tsx`: club sections, supplied position and
  access labels, versions, and confirmed club switching before Open navigates to C's run route.
- `tests/public-run.test.ts`: D's server-action boundary checks.
- `docs/streams/d-wp11-design.md` and this file: design, evidence and owner requests.

No dependency, root configuration, contract, schema, migration, API route, B/C/A implementation,
or existing WP-2/WP-10 product file was changed. Work remains uncommitted on `d/wp2-shell-seed`.

## Integration boundaries

Server pages call fresh `getActor()` and B's published `directory()` / `myAgents(userId)`.
D displays the supplied eligibility and reason labels rather than computing its own grants or
audiences. My agents reuses WP-2's unchanged `changeSession` helper. A rejected or mismatched
active-org confirmation leaves the route unchanged; pending Open actions are excluded list-wide.

A's documented run API is absent. The D-owned page uses a Server Action calling published
`gateway.runAgent` directly. Every submission obtains fresh identity, rejects a stale persona
binding, parses the installation/question, and checks current directory eligibility before the
gateway call. No new API route replaces A's route. Only display fields reach the browser before
a run; no effective system prompt or private agent configuration is serialized.

Run input/output stays in the submitting page's state. It is not stored in browser storage,
query strings, a shared cache or a D-owned database table. Persona/active-org/installation keys
reset the component. Returned citations use titles in the Inspector response; D reads no
documents directly and adds no runtime, retrieval, model or tool implementation.

## Evidence classification

- **Real:** Next.js pages and Server Action, PostgreSQL identity/memberships through the app role,
  A's session endpoints, B's listing interfaces, gateway invocation and mock runtime.
- **Fixture-backed:** B's installation/directory read models; C's document access function;
  A's quota balances and in-memory audit. A real page run does not establish document RLS,
  durable billing, run persistence or durable audit.
- **Arranged:** B publication in an isolated harness process, component empty/loading/error
  states, public quota/network failures, and an intercepted club-switch rejection. These checks
  exercise the actual imported components and published services; they do not complete B's
  publish UI or A's quota implementation.

## Verification environment

Verification uses portable PostgreSQL 17.12 on `127.0.0.1:55432`, with fresh `wp11_tests` and
`wp11_verify` databases. Migration/seeding uses the owner CLI; application and DB tests use
`trojanops_app`. No schema/grant workaround or repository `.env` was created.

The prior portable binaries were reused read-only. A new data directory lives under this chat's
visualization artifact directory. The initial attempt to reuse the old data directory was denied
by filesystem permissions, so no earlier verification database was modified.

Live QA uses `http://localhost:3103`. On this host, the numeric loopback development origin
served markup but did not hydrate client controls; localhost hydrated both existing and new UI.
Turbopack also encountered a Windows temporary-file lock. Verification therefore uses
`next dev --webpack`, a temporary directory outside the checkout, and serialized browser runs.
The final live run used a 1024MB Node heap with an 8MB semi-space. Earlier development-server
and parallel-check attempts exhausted memory; the final full check ran with a 768MB heap after
the Next server was stopped. No Next configuration was edited.

## Checks

| Check | Result and scope |
|---|---|
| Final `pnpm check` | PASS: typecheck, lint, 103 tests, zero skips, invariant and design greps. Fresh `wp11_tests` seed; no alternate test configuration. Log: `.omo/evidence/wp11-final-check.log`. |
| Action boundary | 8 tests pass. Four mutation themes produced the intended failures: stale identity, public-directory bypass, invalid input and dropped quota-error mapping. The action was restored byte-for-byte before final tests and browser checks. |
| Live WP-11 browser | 74 checks pass, 44 captures plus keyboard focus. Real Next pages/session endpoints/Server Action, real memberships, published gateway with mock runtime and documented fixture dependencies. |
| Arranged component states | 73 checks pass, 45 captures. Actual imported components cover publication, empty, loading, retry, quota/network errors, retained draft and pending exclusion/stable button dimensions. |
| WP-2 regression | All 14 existing live session checks pass on real cookies and PostgreSQL. |
| WP-10 regression | All 22 unique integration-panel cases pass: 18 recorded before a development-server interruption, then a successful continuation of the remaining cases. The continuation repeats two setup checks; those are not counted twice. |
| Render detector | Normal live states and all arranged states have zero errors/warnings. Text-spacing stress captures intentionally inject 0.12em tracking and produce eight expected wide-tracking warnings. Shared stylesheet bounce declarations are inactive advisories; short table-cell last lines are recorded typography taste findings. |
| Independent source review | No actionable defect; see `.omo/evidence/wp11-code-review.md`. Final draft guard is clean for all 13 new source files. |
| Independent visual review | Both passes APPROVE in round 1 of 3, covering all 90 live/arranged/focus captures and the 13 source files. No blocking defect; narrow table-cell line balance is recorded as taste. Reports: `.omo/evidence/wp11-final-visual-a.md` and `wp11-final-visual-b.md`. |
| Preservation | All 123 pre-existing source/test/document files match their initial SHA256 values. Branch, root config, dependencies and frozen interfaces are unchanged. |

The eight action tests do not stand in for the live run. The successful live run as Lee used
Showcase Q&A, showed only Spring showcase info, and billed Dance Club. The arranged Recruiting
publication runs B's published service in its own harness process, then obtains directory and
Casey/Taylor My agents data using real memberships. It does not modify the live Next fixture store.

Live checks cover search and combined club/purpose filters; unavailable/internal/disabled ids;
Casey's All members handoff, Taylor's additional Treasurer/President funding agent, and Morgan's
separate club contexts without Startup funding access; pending/rejected/retried club switching;
AI-generated source disclosure; and persona switching plus browser Back without restoration of
another user's transcript. Quota/network errors are arranged because A cannot enforce quota yet.

The initial mobile overflow was a genuine D-owned issue: the hidden Actions heading escaped
the scroll container through absolute positioning. Positioning its header cell fixed both tables.
Fresh viewport checks require `innerWidth` to equal 320/390px and document scroll width to fit;
the earlier comparison against an already-expanded `innerWidth` is not used as final evidence.

### Accessibility evidence

These results cover the inspected D-owned pages and controls; C's Inspector remains an owner stub.

| WCAG 2.2 AA item | Result | Evidence |
|---|---|---|
| Contrast and names | PASS for inspected states | No detector contrast errors; token colors; explicit Club/Purpose and question labels; descriptive Open names. |
| Focus and keyboard | PASS for exercised flows | Live Run button reached by Tab with computed solid outline; Radix filtering/persona controls and existing session keyboard regressions; focus capture. |
| Target size | PASS for new controls | Shared 32/36px controls exceed the 24px pointer minimum. |
| Reflow | PASS | Requested/actual viewport widths match at 320/390px; tables scroll locally; run and Inspector stack without document overflow. |
| Text spacing | PASS for inspected run | Injected WCAG line/word/letter spacing retains content and reflow; deliberate wide-tracking detector warnings are stress inputs. |
| Status and errors | PASS | Named loading states, live pending status, alert errors, supplied access labels and question preservation. |

The bundled optional no-excuse checker requires TypeScript 7 APIs unavailable in the repository's
pinned TypeScript 5.9.3. No dependency was changed to run it. Project typecheck, ESLint, tests,
design/invariant checks and the separate draft guard passed.

Visual approval is scoped to the observed pages/states. Computed type/selection details and
vertical scroll ownership were partly traced from source; no 200% zoom or settled focus-color
measurement is claimed. The live focus check measured a solid outline. The reviewers recorded
these evidence limits and requested no additional product fix.

Artifacts: `C:/Users/14044/.codex/visualizations/2026/11/15/01a1dd0d-6922-7d33-9c42-8c13b1fa1ccb`.
Temporary harness source, test/mutation logs and review receipts are under `.omo/evidence/wp11*`.
These are verification artifacts, not product routes.

### Cleanup

The temporary Next.js, PostgreSQL and component-harness servers are stopped. Ports 3103/3195
have no listener and PostgreSQL on 55432 no longer responds. Owned browsers were closed and
their task profiles removed, including the stale state-harness profile from an interrupted
attempt. No repository `.env` exists. The isolated verification databases and evidence remain
under this chat's artifact directory for reproduction; no prior verification database was reset.
All work remains uncommitted on the original branch.

## Owner requests and full-demo blockers

1. **B / D3:** implement database-backed distribution/listing seeds and the publish UI/API with
   policy, quota and confirmation enforcement. Recruiting Q&A remains disabled in the initial
   fixture. Only Showcase Q&A is public initially; arranged publication is explicitly separate.
2. **C / D4:** implement the internal run route and preview matrices. My agents Open reaches the
   frozen `/org/[orgId]/agents/[installationId]` destination after confirmed club switching;
   that destination currently returns 404. Sam's permission-preview acceptance belongs to C.
3. **A / run infrastructure:** implement the documented run API, durable runs/audit, quota hold/
   settle/enforcement and pending actions. The gateway currently returns fixture quota balances,
   does not persist runs, and cannot produce the real D5 daily-cap block.
4. **C / access and Inspector:** replace fixture document filtering with `withActor`/RLS access
   and complete the Inspector. The imported layout stub is displayed intact; D's wrapper keeps
   its fixed width from causing page overflow. Public-only fixture results do not prove C's RLS
   integration. No C-owned source was changed.

Existing WP-10 blockers (B provisioning/transfer, A's roster-state DELETE grant and durable audit)
remain documented in `d-wp10-verification.md` and are outside this WP-11 slice.
