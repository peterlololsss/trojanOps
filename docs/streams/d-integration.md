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
- D3: directory (Startup Club's Agents tab) and Lee's run.
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

## Component notes

- Import each primitive from its file under `@/components/ui/`.
- `Checkbox` takes native input props (`checked`, `onChange`), not Radix props.
- `Progress` needs an accessible label at its call site; `Skeleton`'s parent supplies the readable
  loading status.
- `Dialog` and `Sheet` content need a Title and Description, or an explicit
  `aria-describedby={undefined}`.
- `Table` is the semantic base, not a TanStack Data Table.
- `tests/seed-db.test.ts` expects a freshly reset database, before a roster sync or manual transfer.

## Demo reset

1. Set `DEMO_MODE=1`, `DEMO_NOW=2026-11-15T10:00:00-08:00` and `AGENT_RUNTIME=mock`.
2. Stop the app, run `pnpm db:reset` (owner URL, CLI only), then restart `pnpm dev`. The clock is
   process-local and restarts at `DEMO_NOW`; a clock jump changes time only and never replaces a
   reset. Do not jump dates during D1–D8.
3. Start at `/` as Avery. Lee's daily allowance lasts one successful public run (D3); a second
   practice run needs a fresh reset.

## D1–D8 runbook

| Beat | Steps |
|---|---|
| D1 | Avery → `/usg/integrations` → Sync roster, twice. Five Mock connectors; Robotics provisioned; existing clubs unchanged |
| D2 | Avery → `/usg/templates`, distribute Event planning. Sam → Startup catalog; attempting the standard model is rejected |
| D3 | Sam publishes Recruiting Q&A. Lee → Directory → Startup Club → Agents → one run; the Inspector shows public sources only |
| D4 | Casey, then Taylor → `/me/agents`; Sam → Startup permission preview |
| D5 | Sam sets Casey to $0.00; Casey's run is blocked. Lee's second public run is blocked |
| D6 | Avery publishes usg-funding v2 at $10,000; Taylor's funding-precheck names v2 |
| D7 | Sam transfers Treasurer Taylor → Jordan; compare My agents; Avery syncs, nothing changes |
| D8 | Avery → `/usg/audit`; Sam → club audit. Metadata only; unreadable titles read "Restricted document" |

Say "mock runtime" and keep the Mock labels visible. If a real agent misbehaves, restart with
`AGENT_RUNTIME=mock`.

## Open requests

- **A:** `AppError` has no server-error code, so a failed roster audit (which rolls the sync back) surfaces as `invalid` (400).
