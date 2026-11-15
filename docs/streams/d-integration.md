# Stream D: Integration and demo

## Judge presentation, 2026-11-15

`/demo` now gives the five-beat presentation with role switches and direct links. Avery creates
an Organizer briefing template and distributes it to the pilot cohort. Sam manages HackSC and
its departments. Directory and Management summaries are labeled Demo and use authorized visible
records. Casey opens the member-level HackSC organizer handoff, reads the historical operational
lessons and gets a finance-access refusal. Workspace headers identify a distributed agent's
publisher and receiving club, such as USG → HackSC, beside its version.

HackSC is an additive constructed scenario alongside Startup, Archery and Dance. The normal seed
includes it. For an existing demo database, run `node --env-file=.env --import tsx scripts/demo-setup.ts`
to insert only missing scenario records in one transaction. Existing documents, versions,
memberships and limits are preserved. The added roles are Sam as president, Taylor as treasurer
and member, and Jordan and Casey as members. Roster CSV includes the same assignments.

Prompts and answers are English-only. Run requests show an animated access/quota indicator.
Completed mock answers play word by word with animated progress, real document counts and
source citations. Stop ends playback and the full answer remains available. Reduced motion
shows the finished answer immediately and leaves the progress icons static.

## Chat and usage delivery, 2026-11-15

Directory run pages now consume C's shared `RunWorkspace` and configuration. `/me/usage` shows
real private metadata, allowances and blocked attempts, with no prompts or replies. The reusable
Markdown renderer emits safe React elements with a link-protocol allowlist and numbered citation
buttons outside code. Tailwind scans only `src` so local DB and browser files cannot trigger HMR.

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
- Choosing an internal agent on `/me/agents` switches the active club before its chat opens.
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
| D6 | Avery publishes the USG Funding Department Guidelines as v2 (§3 at $10,000) in /usg/documents; Taylor's funding-precheck names "USG Funding Department Guidelines (v2)" |
| D7 | Sam transfers Treasurer Taylor → Jordan; compare My agents; Avery syncs, nothing changes |
| D8 | Avery → `/usg/audit`; Sam → club audit. Metadata only; unreadable titles read "Restricted document" |

Say "mock runtime" and keep the Mock labels visible. If a real agent misbehaves, restart with
`AGENT_RUNTIME=mock`.

## Open requests

- **A:** `AppError` has no server-error code, so a failed roster audit (which rolls the sync back) surfaces as `invalid` (400).

## Connector CSV views and demo summaries

The **Management** overview (at the existing `/usg/integrations` URL) contains a **Clubs and quotas**
row linking to the existing `/usg/clubs` console, plus all five connector rows with **View details** linking to
`/usg/integrations?connector=<kind>`. The existing page handles the selection after USG-admin
authorization. Each selection renders a full-page CSV projection and its own **AI summary · Demo**;
the summary uses local text and current counts, not a model call. Back returns to the overview.
The USG sidebar groups club quotas under Management rather than listing them separately. Management
remains highlighted while the club-quota console is open. This changes navigation and labels only;
club quotas, policy permissions and route contracts are unchanged.

The datasets are actual current platform data, not fabricated CSV fixtures:

- Identity: current accounts and membership history, grouped by person and organization. Any
  remaining active position means **Active member**; only ended positions means **Left
  organization**. Ending one office does not count as leaving while another position remains
  active. The table includes the last departure date for former memberships, and the summary
  counts current and former person–organization relationships separately.
- Roster: `RosterSource.fetch()` reads the current `db/seed/roster.csv`; source identifiers are
  stripped, and counts distinguish people from multiple position rows.
- Documents: C's document-library service recomputes grants and enforces RLS for each library.
  Only readable metadata is projected, deduplicated across libraries; no document bodies are read.
- Language model: the current model connector plus the latest 200 rows of `agent_runs_meta`,
  selecting only person, billed club, recorded model, status, cost and timestamp. Run input/output
  and document references are never selected. Mock records are identified as demo activity.
- Applications: actual references from the internal submission queue in the current server
  process, excluding arbitrary application payloads. This queue is not durable; no submissions
  means an empty table. Run-page confirmation still does not invoke a submission executor.

`loadConnectorPreview` independently checks USG-admin authorization before reading any dataset.
A failed source produces an error for that selection without exposing internal error details.
Previewing never imports or changes records. **Sync roster** and its pending/error/result feedback
remain separate actions on the overview; no new API route, contract or schema is introduced.

`tests/connector-preview.test.ts` covers query selection, authorization, actual current accounts,
roster failure isolation, RLS-filtered document metadata, private run-content exclusion and
submission-reference projection. `tests/roster-preview.test.ts` covers accurate source counts.

The persona seed includes two ended membership examples: Lee formerly belonged to Dance Club;
Casey formerly belonged to Archery Club and remains a Startup Club member. These historical rows
do not change the active persona memberships or imported roster baseline and grant no access.
`tests/member-status.test.ts` covers club departure versus office changes, rejoining, departure
dates, identical display names and accounts without history. Seed acceptance also verifies the
historical examples and unchanged active memberships.

## My agents cards and sample agents

The agent rail now uses compact inset cards, following the requested card view. The workspace
keeps chat and Run details alongside selection. Four additive examples ship through the normal
seed: Meeting recap and Event retrospective for Startup members, Archery getting started and
Dance Audition guide for all students. Public examples have Public-only sources and explicit
installation budgets. All use Economy on the mock runtime. Archery currently has no public
seed document, so its guide reports missing source material rather than inventing an answer.

## Personal projects

On My agents, Projects opens a list of named projects with notes and an optional Agent.
Projects are stored per account in the current browser. Opening a linked Agent uses the
existing workspace navigation, including the club switch for internal agents. The project
does not supply run input or store transcripts.

Demo check: As Casey, open Projects, create a project linked to an Agent, and add a note.
Reload, reopen Projects, and check the note. Select Open agent and verify the correct Agent
opens. Switch to Lee and verify Casey's project is absent, then switch back to Casey.

Selecting an Agent in My agents also exposes **Project files**. The file library is stored in
IndexedDB per account and installation. Downloads preserve the uploaded file, and removal
requires confirmation. These files are separate from the organization's knowledge sources.
Demo check: add a file to one Agent, refresh and download it, check a second Agent and a
different persona for isolation, then return to the original Agent and remove the file.
