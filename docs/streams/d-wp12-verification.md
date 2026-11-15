# WP-12 delivery and verification

The D-owned clock controls and demo preparation materials are delivered. WP-12 as a whole is
**blocked**, not accepted: three complete D1–D8 rehearsals and the final narrated backup require
the remaining P0 owner implementations. No full-demo recording or completed rehearsal is claimed.

## Slice manifest

All product, test and documentation files in this slice are new:

- `src/app/demo/page.tsx`: demo-only operational page, last confirmed clock time, CLI reset
  sequence and mock-runtime fallback.
- `src/app/demo/clock-control.tsx`: timezone-explicit input, Pacific display, server confirmation,
  pending exclusion, validation, draft preservation and retryable errors.
- `src/app/api/demo/clock/route.ts`: the frozen documented POST route, using A's route/parseBody
  helpers and published clock setter. No schema, contract or root configuration changes.
- `tests/demo-clock.test.ts`: 11 boundary cases using the real shared clock and deterministic
  fake system time; only request identity is replaced in this isolated unit suite.
- `docs/streams/d-wp12-{design,rehearsal,verification}.md`: design brief, continuous D1–D8 operator
  script, reset procedure, rehearsal ledger, video export/playback checklist and timed pitch.

Work remains uncommitted on `d/wp2-shell-seed`. Previous WP-2/10/11 edits are preserved.

## Behavior and boundaries

The API accepts JSON `{ "now": "2026-11-15T10:00:00-08:00" }` and confirms a canonical UTC
`now` string. ISO timestamps require Z or an explicit offset; malformed JSON, invalid calendar
dates, missing fields, extra fields and non-JSON content types return 400 without moving time.
Outside DEMO_MODE=1 it returns 404 before resolving identity or parsing the body. The page also
returns not-found outside demo mode. Access inside demo mode follows the documented mode-only
policy; it is deliberately usable across persona switches, including while signed out.

Time is read and changed solely through A's clock. The anchor is shared by pages and handlers
in the same Node process and advances after a jump. Multiple server processes are not coordinated;
the runbook requires one process. There is no HTTP database reset and no owner URL in a route.
Changing time cannot clear usage or restore earlier memberships, distributions or publication state.

## Verification

| Check | Result |
|---|---|
| Focused endpoint suite | 11/11 pass: shared advancing time, mode gate and seven malformed input classes |
| Full `pnpm check` with reachable PostgreSQL | 114/114 tests pass, zero skips; typecheck, lint, invariant/design checks pass |
| Lint qualification | Three existing warnings in WP-11 evidence scripts; zero errors. No product lint warning introduced |
| Live `/demo` | HTTP 200 from real Next.js 16.4.6 using webpack; real shell and published clock, no component substitutes |
| Live browser interactions | Invalid timestamp error; successful offset timestamp displayed in Pacific Time; reload observes shared anchor; real HTTP POST returns canonical time |
| Reflow | Requested/actual widths 390, 1440 and 1920; document scroll widths equal viewport widths |
| Source review | Each new source file has one responsibility, parses external values at its boundary, uses existing primitives/tokens and introduces no casts, mutable exports, model calls or document reads |
| Existing behavior | All existing 103 automated cases still pass. Prior WP-11 live/session/integration checks are historical evidence; they were not rerun in this slice |

The first DB-free check passed with 55 skipped database tests. The final acceptance check used
a freshly migrated and seeded isolated PostgreSQL 17.12 database `wp12_tests` on 127.0.0.1:55432.
Application tests connect as trojanops_app; only the reset CLI uses the owner. Portable binaries
were reused read-only, with a new data directory in this chat's writable artifact folder. No
repository `.env`, dependency change, alternate test config or database grant workaround was used.

The initial browser attempt acted before hydration and submitted the native form. The successful
run explicitly waits for React readiness before interacting. Its captures and JSON replace that
failed attempt as evidence. A navigation readiness timeout was bypassed through the browser
skill's documented commit-navigation option. These were capture-pipeline issues, not passing runs.

Browser evidence is intentionally bounded: no production Lighthouse score, complete visual-QA
matrix, independent visual approval, pending/network interception, or live demo-mode-off page
capture is claimed. The mode-off HTTP boundary is covered by the automated tests. Screenshots
were inspected for hierarchy, legibility and reflow; all new source files remain below 200 LOC.

The initial development CSS cache omitted the new 640px utility. Clearing the generated Next
cache and restarting regenerated it; the final captures and successful interaction run were
repeated against that fresh build. The desktop form now measures within the specified width.
Final check output is saved in `.omo/evidence/wp12-final-check.log`.

Preservation: all 139 pre-existing source/test/document/seed files match their starting SHA256
hashes (`wp12-preservation.json`). Temporary Next.js and PostgreSQL servers are stopped, the owned
QA browsers are closed, and ports 3103/55432 have no listener. No repository `.env` exists.

Artifacts: `C:/Users/14044/.codex/visualizations/2026/11/15/01a1dd6c-852f-76d0-8b64-143a660ddf3a`.
See `demo-{390,1440,1920}.png`, `demo-invalid.png`, `demo-confirmed.png`, `wp12-live.json` and
`.omo/evidence/wp12-browser.mjs` / `wp12-live.log` for the actual checks and captures.

## Acceptance ledger

| Requirement | Status |
|---|---|
| Clock control and reset command | Implemented and checked within D ownership |
| Continuous rehearsal instructions, pitch, backup recording/playback expectations | Delivered in d-wp12-rehearsal.md |
| Three successful integrated D1–D8 rehearsals | Blocked; zero complete runs claimed |
| Backup video after final rehearsal | Blocked by the same dependencies; no final video exists |
| Platform-freeze/demo tags | Not created; acceptance checkpoints are not established |

The detailed per-beat dependency table is in the rehearsal runbook. Owner requests remain:
B must complete provisioning, database-backed listings/seeds, distribution/publication/rule-pack
pages and transfer; C must complete Inspector, internal run/preview and audit views with real
document access; A must complete quota/usage seed, durable runs/audit, documented run endpoint,
and roster_state DELETE permission. D must then reset, perform three continuous rehearsals and
record/play back the final backup. Fixture-backed listings/documents, in-memory audit, arranged
errors and mocked runtime answers must stay explicitly identified throughout the presentation.
