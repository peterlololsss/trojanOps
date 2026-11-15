# Stream D: Integration and demo

**Owner:** TBD. You own the look and the front door: app shell and shared components, connectors
and the integration panel, the student pages (my agents, directory), seed people, and the demo
itself. Your paths are in `AGENTS.md`.

## Work packages

| WP | Hours | Done when (full text: `docs/architecture.md` §16) |
|---|---|---|
| WP-2 | H2–5 | Seed runner, orgs and personas; app shell; shadcn components restyled per `ui-designer.md` so the design greps pass |
| WP-10 | H5–9 | Connectors, registry, integration panel, roster sync with precedence; D1 |
| WP-11 | H9–12 | Directory, public-agent runs, my agents; D3, D4 |
| WP-12 | H12–20 | Clock control, rehearsed D1–D8, backup video, pitch |

## You provide

Stubs by H3.

| Interface | Real by |
|---|---|
| App shell, `src/components/ui/*` | H5 |
| Connector registry, `RosterSource` | H9 |

## You consume

- B: `directory`, `myAgents`, `provisionOrg` (real H7) and `transferPosition` (real H9).
- A: `gateway.runAgent` (real H9).
- C: `<Inspector />` (real H10).

## Demo beats

- D1: integration panel and roster sync.
- D3: directory and Lee's run.
- D4: my agents.
- You also run the whole demo script.

## Watch for

- The components the pages need ship with shadows and pills (DropdownMenu, Popover, Select, Dialog,
  Sheet, Switch, Progress, RadioGroup). Restyle them in WP-2 or every `pnpm check` fails.
- `roster.csv` mirrors the seed plus Robotics Club, and a sync right after a manual transfer changes
  nothing.
- "Open" on `/me/agents` switches the active club before opening the run page.
- Every connector shows "Mock" honestly.

## First prompt

> Read `AGENTS.md`, `.claude/agents/ui-designer.md`, `docs/architecture.md` §14–§16, and
> `docs/streams/d-integration.md`. Plan WP-2: seed runner and personas, the app shell, and the
> restyled shadcn components. Edit only stream D paths. Show me the plan first.

## WP-2 current delivery

The current slice provides:

- Atomic seed orchestration: all five area seeds run in one transaction, in foreign-key order.
  Organizations, personas and the CSV keep the WP-0 fixed ids and §15 data.
- A shared AppShell with scope-specific side navigation, nested-route selection, a skip link,
  demo-only Persona menu and the required footer. The masthead uses A's session endpoints for
  persona, active-club and sign-out changes, with pending feedback and retryable errors.
  Management links follow the active actor; request authorization remains with A/B/C services.
- Dependency-free UI primitives: Button, Input, Textarea, Label, Checkbox, Table, Badge, Card,
  Alert, Skeleton, Progress and Separator. Import each from its file under
  `@/components/ui/`. Checkbox uses native input props (`checked`, `onChange`), not Radix
  props. Progress requires an accessible label at its call site; Skeleton's parent supplies
  the readable loading status. Table is the semantic base, not a TanStack Data Table.
- Radix-backed DropdownMenu, Popover, Select, Dialog, Sheet, Switch and RadioGroup, restyled
  with the shared tokens. Dialog and Sheet content require a Title and Description (or an
  explicit `aria-describedby={undefined}` when there is no description). All retain Radix
  focus handling. Session menus wait for matching server confirmation before navigation.
- Seed specification tests and pure navigation tests. The optional `seed-db.test.ts` suite
  expects a freshly reset database, before roster sync or a manual transfer.

### Remaining integration requests

- **A / deps:** add TanStack Table in a separate deps PR for later data-table pages.
- **A/B/C:** distribution, document and quota seed bodies remain owner stubs. Their presence lets
  D's seed runner compose them; it does not mean the complete demo dataset has been populated.
- Main `08ccd3a` supplies Radix and the Windows check/alias fixes. A's persona and active-org
  endpoints are present and consumed directly. No root config or lockfile was changed by D.

### Validation of this slice

- `pnpm check` passed against a freshly migrated and seeded PostgreSQL 17.12 database:
  typecheck, lint, all 71 tests passed with zero skips, and invariant/design greps passed.
  No alternate test config was used. The earlier DB-free run passed 28 tests and skipped 43.
- Real Next.js `/` returns 200 with DEMO_MODE=0; the shell has a 48px masthead, 24px content
  padding and Source Sans 3. Persona data and switching were checked in a temporary browser
  harness importing the real shell components with fixture HTTP responses and router state.
- Browser checks passed for rejected-session preservation, retry, pending-request exclusion,
  club refresh, Lee's student-only scopes, sign-out, and 390px shell reflow. Shared Radix
  components passed keyboard selection, Escape/focus return, modal focus containment, control
  state, disabled state and 390px overlay bounds checks.
- Frozen dependency installation passed with bounded memory/concurrency. This host's bundled
  pnpm reports 11.25.0, while the manifest declares 12.18.0; the latter was not verified.
- PostgreSQL verification used an isolated portable instance on `127.0.0.1:55432`, with
  `wp2_verify` for reset/check/live sessions and `wp2_rollback` for a forced seed failure.
  The app role is non-superuser `trojanops_app` without BYPASSRLS; documents and runs have
  forced RLS. Seed counts are 4 orgs, 8 users, 9 active memberships, 2 cohort entries and 7
  roster rows. A duplicate-persona failure left no earlier organization/position rows committed.
- Fourteen live browser checks passed with real session endpoints, browser cookies and database
  memberships: Morgan's two club contexts persist after navigation, Casey cannot switch to
  Archery, Sam/Avery get their management scopes, Lee has student scopes only, and sign-out
  persists. Invalid persona, malformed JSON and signed-out club requests return 404/400/401.
- `/org/[orgId]` currently returns 404 because the Stream B page is not implemented. Session
  switching and shell navigation were verified independently of that destination's content.
  Full D1-D8 acceptance still requires the other streams' seed and page implementations.

See `docs/streams/d-wp2-verification.md` for scope and acceptance cases.
