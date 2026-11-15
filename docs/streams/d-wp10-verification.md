# WP-10 implementation and verification

Historical verification before main `414eb83`. See [post-main integration](d-main-integration.md)
for current dependency status and the fresh combined check.

Stream D's connector registry, roster importer, integration panel and frozen sync route are
implemented. Full D1 acceptance remains blocked by the Stream B provisioning/seed stubs.
This slice does not substitute for those services or claim that an agent was installed.

## Changes in this slice

- `src/lib/connectors/registry.ts`: validate and capture CONNECTOR_* on first use; persist five
  connector implementations; preserve stored health and last successful sync; record roster health.
- `src/lib/connectors/roster/mock.ts`: read the real CSV; parse quoted fields and reject malformed
  or incomplete records with a typed API error.
- `src/lib/lifecycle/import.ts`: require a real active USG admin membership; reconcile organizations,
  users, positions and memberships in a PostgreSQL transaction; compare holder sets against
  roster_state so unchanged source data preserves a manual transfer; call published provisioning
  and audit interfaces; record completion or degraded health.
- `src/app/usg/integrations/{page,integration-panel,sync-request,loading,error}.tsx` (the request
  helper is `.ts`): permission, loading, result, pending, health and retry states.
- `src/app/api/usg/connectors/roster/sync/route.ts`: the existing documented POST route, using
  `route()` and JSON-body parsing. Unexpected fields and cross-site form content types are rejected.
- `tests/connectors.test.ts`, `tests/roster-import.test.ts`: behavior coverage. Only D's former
  connector shape test/imports moved out of `tests/skeleton.test.ts`, as that file requests.
- `docs/streams/d-wp10-design.md` and this file: WP-10 design and acceptance evidence.

WP-2's uncommitted files were preserved byte for byte, and its existing seed and session checks
continue to pass. WP-10 remains uncommitted on `d/wp2-shell-seed`; the manifest above separates
this slice from WP-2. No dependency, root configuration, schema, migration or frozen interface
file was changed. No repository `.env` was created.

## Integration boundaries

The importer reads only through `getConnectors().roster.fetch()` and uses the application DB role.
All timestamps come from `clock.now()`. Audit details contain counts and ids, not roster payloads,
document text or run data. No document, runtime or model path was added.

An advisory transaction lock serializes roster reconciliation. It does not serialize the entire
post-import provisioning sequence across requests. `provisionOrg` has no transaction argument,
so it is called after roster commit, when a real implementation can see new organizations.
Every retry reconciles provisioning for all represented/tracked clubs, including clubs created
by an earlier partial attempt. B must make provisioning idempotent and safe for overlapping calls.
The UI prevents overlapping clicks within one mounted panel.

An unchanged roster holder set leaves current memberships alone. A changed set ends holders no
longer present and starts missing holders; ended membership history remains. Equal-size holder
replacements update the existing roster_state keys. Empty/conflicting rosters and attempts to
overwrite USG or inactive organizations fail. An entirely omitted previously tracked club is
treated as removal of its imported holders, subject to the permission dependency below.

## Verification

Verification used isolated portable PostgreSQL 17.12 on `127.0.0.1:55432`. `wp10_tests` retains
the fresh seed for repeatable rollback-based tests; `wp10_verify` hosts persistent live browser
syncs. Migrations/seeding use the owner CLI; application/tests use `trojanops_app`. No grant or
schema was patched to make acceptance pass.

| Check | Result and scope |
|---|---|
| `pnpm check` | Passed: typecheck, lint, 95 tests, zero skips, invariant and design greps. |
| Connector tests | 16 passed; real registry persistence and health/time preservation; parser/config unit cases. |
| Roster tests | 9 passed on fresh seed with real PostgreSQL and rolled-back writes. Includes Robotics, repeat sync, arranged manual succession, source-driven replacement, authorization, USG protection, provisioning retry and completion-audit failure. |
| Mutation evidence | CSV/registry mutations caused 3 intended failures; roster precedence/retry/audit mutations caused 5 intended failures. Restored connector/importer code passed again; importer restoration verified by SHA256. |
| WP-2 live regression | All 14 prior real session/persona/club/sign-out browser cases passed against the current app and database. |
| WP-10 live browser | 22 checks passed: real permissions/body validation, five persisted connectors, Robotics import, existing clubs at 0 position changes, repeat at 0, timestamp persistence, 320/390px mobile emulation, keyboard traversal/focus, pending exclusion, error/retry, reduced motion and text spacing. |
| State harness | 10 checks passed on actual imported loading/error/panel components: retry callback, five Mock rows, down/degraded banners, no overflow or console/runtime errors. |
| Render detector | Zero errors, warnings or advisories at 1440, 390 and 320px, including arranged degraded/down states. |
| Independent visual review | Both fresh read-only passes approved all 24 captures in round 2 of 3. The locally corrected pending button is neutral and readable; settled errors, mobile emulation and keyboard evidence passed. |

The first real sync created Robotics Club, Quinn/Rowan/Blake, three positions and three memberships.
Startup and Archery retained their original membership rows and reported 0 position changes.
The real service returned **0 installed agents**, consistent with B's current no-op implementation.
Repeating the real sync returned 0 roster changes. Last successful sync survived full navigation.

The live pending/HTTP-failure case used an intercepted response; its retry used the actual service.
Health captures used arranged persisted status values. The loading/error/degraded harness used
fixture props and a retry callback, importing the production components rather than copying UI.
The manual transfer test arranged genuine membership rows directly because B's transfer service
does nothing yet. Its successful precedence result is not evidence that B's transfer endpoint works.
The provisioning retry test exercises orchestration across a mocked published B boundary; it does
not establish that templates, sources, quota or policy were installed. A's audit writer was called,
but remains an in-memory stub, so no durable audit claim is made.

### Accessibility and visual evidence

The authoritative design is light-only, desktop-first, with 36px controls and local horizontal
scrolling for wide tables. Generic dark-mode and mobile-app requirements do not apply.

| WCAG 2.2 AA check | Result | Evidence |
|---|---|---|
| Contrast | PASS for inspected page/states | Render detector reports zero contrast findings; Cardinal/neutral/status tokens match the shared system. |
| Focus and keyboard | PASS for new controls | Real keyboard focus has a visible 2px solid outline; Enter syncs; pending excludes another request; actual error retry executes once. |
| Target size | PASS | New Sync and Retry controls exceed the 24px pointer minimum. |
| Reflow | PASS | No document overflow at 320/390px; wide table content scrolls in its own container. |
| Status and names | PASS | Icon plus status word, named action buttons, table headers, live progress/result region. |
| Text spacing | PASS for inspected page | Increased line/word/letter spacing retains document reflow at 390px; wide tables retain local horizontal scrolling. |

Fresh screenshots and machine/browser records are in the current chat's visualization artifact
directory, `C:/Users/14044/.codex/visualizations/2026/11/15/01a1dce3-77f5-7902-8dce-dd2a8e9cdc39`.
They include `live-wp10-checks.json`, `wp10-console.json`, `detect-wp10.json`,
`wp10-panel-state-harness-checks.json`, and the 24 page/state captures. Test/mutation logs and
temporary harness sources are under `.omo/evidence/wp10*`. These artifacts are not product routes.
Final visual reports are `.omo/evidence/wp10-final-visual-a-gate-review.md` and
`.omo/evidence/wp10-final-visual-b.md`. The Next development indicator appears in live captures;
it is development tooling, rather than product content.

At completion, the temporary Next.js/PostgreSQL servers and harness servers were stopped;
owned browsers were closed and their profiles removed. The temporary package cache was removed
from the workspace. The 36 pre-existing WP-2 source/test/document files matched their initial
SHA256 values. All work remains uncommitted on the original branch.

## Owner requests and remaining acceptance blockers

1. **B / D1:** implement `provisionOrg` and `seedDistribution`. The current service returns
   `{installed: 0}`; the seed creates no distributed funding-precheck template. Robotics therefore
   has no template installation, default sources, quota or club policy through that service.
   Full D1 must be rerun from fresh reset after B's real implementation and seed land.
2. **A / contract:** grant only `DELETE ON TABLE public.roster_state TO trojanops_app` through
   the required contract migration. The current app role has no DELETE permission. Shrinking
   holder sets/removing positions cannot be represented by the frozen baseline table without it.
   These syncs currently return an actionable invalid error and roll back all roster mutations;
   the last successful sync time stays unchanged. No owner URL, sentinel identity or schema
   workaround was added. The grant must not widen append-only audit/usage privileges.
3. **B / succession integration:** replace the `transferPosition` no-op and verify its endpoint
   followed by a real unchanged roster sync. D's arranged-state precedence test already passes.
4. **A / durable audit:** replace the in-memory `audit()` writer, then verify durable
   `roster.import` and `connector.sync` rows. The current service calls the published writer.

There is no new external USC integration. Identity, CSV roster, uploads, model and application
queue are deliberately labelled Mock, as specified for the hackathon.
