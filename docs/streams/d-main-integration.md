# Stream D integration after main 632785a

The Stream D branch was fast-forwarded from 08ccd3a to main 414eb83, then the preserved
WP-2/10/11/12 work was committed in separate work-package commits. The branch was then rebased
onto newly merged main 632785a. Both integration conflicts in `tests/skeleton.test.ts` were resolved
by retaining A/C's upstream stub-test removals and D's connector stub-test removal. No behavior
test was weakened. The original local file remains in a backup
stash; local evidence and dependency stores are excluded from the PR.

The earlier work-package verification files record observations against their original builds.
Their references to missing A/B/C implementations are historical, not the current baseline.

## Current combined verification

- Frozen dependency installation succeeded against main's existing lockfile, including TanStack
  Table. No manifest, lockfile, frozen contract, schema or migration was changed by Stream D.
- `pnpm db:reset` and `pnpm check` passed on isolated PostgreSQL 17.12 `wp12_tests` at
  127.0.0.1:55432: **321 tests passed, zero skips**, typecheck, lint and invariant/design checks.
  Three existing warnings belong to uncommitted local WP-11 evidence scripts; no lint error.
  Latest log: `.omo/evidence/stream-d-latest-main-check.log`; the first post-pull check at 414eb83
  passed 311 tests (`stream-d-post-main-check.log`).
- The real Next.js app and real shared clock passed fresh browser checks after the pull:
  valid/invalid clock submission, Pacific display, reload observing the changed anchor, HTTP
  confirmation and 390/1440/1920px reflow. No substitution of the clock endpoint or components.
  Log: `.omo/evidence/stream-d-post-main-live.log`.
- Earlier directory, session, integration-panel and visual review evidence was not rerun in full
  after the pull; it remains evidence for the earlier builds only.

## Current owner boundaries

| Owner | Now integrated from main | Remaining demo dependency |
|---|---|---|
| A | Durable gateway runs/audit, quota hold/settle/enforcement, pending confirmation, documented run and quota APIs | Roster removals still need the roster_state DELETE grant; full beat/UI integration must be demonstrated |
| B | Database-backed distribution seeds, installation resolution, directory/My agents, publication service and provisioning | Publication/distribution/rule-pack/admin UI and transferPosition remain incomplete |
| C | Seeded documents, RLS access, library/upload page and permission preview | Inspector remains a stub; internal run/audit pages remain incomplete |
| D | Shell, atomic seeds, connector registry/roster sync, integration panel, student pages, demo controls | Three continuous D1–D8 rehearsals and final backup video remain blocked by the remaining owner work |

The public page's existing Server Action still calls the published gateway directly and obtains
fresh identity. A's run API now exists; the earlier reason for using a Server Action is historical.
Every run still uses the gateway, and D introduces no runtime, grants, document-access or quota
substitute. Connectors and agent answers remain honestly labeled as mocks.

No full D1–D8 acceptance, platform-freeze/demo tag or final backup video is claimed by this PR.
Use the WP-12 runbook after the remaining owner work lands, starting each complete rehearsal from
a fresh reset. A human review from another stream is still required before merge.

The required independent source review returned APPROVE with no blockers. Its nonblocking
seed-test typing suggestion remains a follow-up. The reviewed D product source is unchanged by
the subsequent rebase; the only test conflict removes obsolete skeleton sections already covered
by their owner suites. Receipt: `.omo/evidence/stream-d-pr-review.md`.
