# WP-2 implementation and verification

## Design brief

The authoritative design system is `.claude/agents/ui-designer.md`. The shell serves students,
club officers and USG administrators; shared primitives serve all four development streams.
The first priorities are the active scope, the current identity, and the page's primary action.
The shell itself provides navigation and session controls rather than a competing primary action.

Layout: masthead and scope sidebar around fluid page content; document owns vertical scrolling,
the scope strip owns horizontal overflow on narrow screens, and wide data tables scroll locally.
Source: the repository's app-shell specification in `.claude/agents/ui-designer.md`.
Avoid nested vertical scroll containers and preserve DOM reading order.

Keep the specified light-only Cardinal/Gold palette, Source Sans 3 UI, Caslon page titles,
Source Code Pro identifiers, 48px masthead, 24px page padding, 36px form controls, 40px table
rows, 2px chips and 4px panels. Active navigation intentionally retains the specification's
Gold underline and Cardinal side bar. Only overlays receive `shadow-overlay`.

Existing Button, Input, Textarea, Checkbox, Label, Table, Badge, Card, Alert, Skeleton,
Progress and Separator remain reusable. Add Radix DropdownMenu, Popover, Select, Dialog,
Sheet, Switch and RadioGroup with keyboard navigation, named controls, visible focus,
Escape dismissal and focus restoration. Menu and selection rows are 36px; switches and
radio controls have at least 24px hit targets. Dialogs require a title and description.

## Acceptance cases

- Seed: four organizations, eight personas, nine active memberships, two pilot cohort entries,
  seven roster baseline entries; Robotics exists only in CSV until WP-10.
- Seed runner: owner seed modules run inside one transaction, and a failure propagates.
  Actual PostgreSQL rollback is distinct from the existing mock orchestration test.
- Shell: signed out and Lee see student scopes; Sam sees club management; Morgan's active club
  governs the scope; only Avery's USG admin context shows administration links.
- Session: DEMO_MODE controls persona visibility. Session requests use A's existing endpoints;
  the server remains authoritative. Failure leaves the current identity and club intact and
  shows a retryable error. Pending requests cannot overlap.
- UI: verify opening, keyboard choice, Escape, focus return, checked state and disabled state
  on the actual imported primitives in a temporary browser harness.
- Run `pnpm check` and record database skips separately. Check the real Next shell as well as
  the isolated component harness. No permanent component-demo route is added.

## Scope and dependencies

Only D source paths, their tests, and these shared docs are edited. The existing root toolchain
and frozen contracts remain authoritative. No additional React instrumentation or test packages
are installed because dependency changes belong to A's separate deps PRs.

Dependency baseline on main `08ccd3a`: frozen installation and `pnpm check` passed; 17 tests
passed and 43 database tests skipped. Radix imports resolve. This host's bundled pnpm reports
11.25.0 rather than the manifest's 12.18.0; no manifest or lockfile was changed. Memory-bounded
verification uses `NODE_OPTIONS=--max-old-space-size=768` and `UV_THREADPOOL_SIZE=2`.

PostgreSQL acceptance needs an available disposable demo database. A/B/C's quota, distribution
and document seed bodies remain their owners' work. TanStack-backed tables belong to later
page integration once its dependency is supplied; WP-2 supplies the semantic table primitives.

## Final verification

| Check | Result |
|---|---|
| `pnpm check` | Passed against PostgreSQL: typecheck, lint, invariant/design checks; all 71 tests passed, zero skipped. |
| Real Next shell, `DEMO_MODE=0` | HTTP 200; desktop 1440px and mobile 390px captures have no horizontal overflow, with a 48px masthead and 24px content padding. |
| Session browser harness | Passed rejection/retry, pending-request exclusion, active-club switching, Lee's student scopes, sign-out, and mobile layout. Transport and router responses are fixtures. |
| Live PostgreSQL sessions | Fourteen browser checks passed using real endpoints and browser cookies, including persisted club/persona changes, membership denial and sign-out. |
| Seven Radix primitives | Passed keyboard/focus and state checks; desktop and mobile overlays visually inspected. |
| Independent review | No functional, security, or visual blockers. Preserved seed-test casts and shell-test non-null assertions are non-blocking maintenance notes. |
| Scope | No root dependency/configuration, frozen contract, schema, or migration changes; `git diff --check` passed. |

## PostgreSQL verification, 2026-11-14

An isolated PostgreSQL 17.12 instance was initialized from the EDB Windows binary archive.
The server executable has a valid EnterpriseDB signature. It listened only on
`127.0.0.1:55432`, with SCRAM password authentication. No existing database was reset and no
repository `.env`, dependency, schema or migration file was changed.

- `wp2_verify`: `pnpm db:reset` migrated and seeded successfully, followed by `pnpm check`
  with all 71 tests executed. Runtime/tests connected as `trojanops_app`, with `rolsuper=false`
  and `rolbypassrls=false`; documents and agent runs have RLS enabled and forced.
- Persisted seed data: 4 organizations, 8 users, 9 active memberships, 2 cohort entries and
  7 roster rows. The seed acceptance tests also checked exact identities and relationships.
- `wp2_rollback`: actual migrations plus a pre-existing Avery row caused the actual seed
  runner to fail with SQLSTATE `23505`. Organization, cohort, position, membership and roster
  counts were all zero afterward; the pre-existing user remained. This establishes physical
  rollback of earlier seed writes without mocking the database or seed functions.
- The live Next server used `DEMO_MODE=1` and only the app-role URL. Browser checks covered
  all eight rendered personas; Morgan switching Startup/Archery and persisting each across a
  full navigation; Casey's forbidden Archery switch preserving Startup; Sam's administration
  links; Avery's USG scope; Lee's student-only context; and persisted sign-out. Additional
  live HTTP checks returned 404 for an unknown persona, 400 for malformed JSON and 401 for a
  signed-out club switch. No fixture transport or router was used for these checks.

The Stream B `/org/[orgId]` page currently returns 404. The real session changes and shell
navigation work, but destination page content remains the owner's implementation work.
Distribution, documents and quota seeds are still owner stubs, so these results establish
WP-2 database acceptance rather than complete D1-D8 demo readiness. The current migrations
do not use pgvector; this verification covers PostgreSQL and RLS, not future retrieval.

Local verification artifacts are in this chat's `postgres-qa` artifact folder: `reset.log`,
`check.log`, `database-facts.log`, `rollback.log`, `live-session-results.json` and live browser
captures. The temporary Next and PostgreSQL servers are stopped after verification.
