# TrojanOps

A platform for USC student government (USG) and student clubs. USG distributes agents, quotas and
document permissions to clubs; clubs expose agents to their members or to all students; the platform
gateway governs every agent run; Postgres row-level security decides which documents a run can
read. Built by four people for the AI@USC Hackathon (Nov 14–15, 2026). The platform runs on a mock
agent runtime; real agents (model, retrieval, tools) are built last.

| Read | When |
|---|---|
| `docs/streams/<your stream>.md` | before any task: your scope, interfaces, hours |
| `docs/architecture.md` | the spec: invariants §2, data model §5, contracts §6, gateway §7, routes and pages §14, work packages §16 |
| `docs/workflow.md` | branches, PRs, contract changes, working with agents |
| `docs/decisions.md` | decisions already made; don't reopen them without the team |
| `.claude/agents/ui-designer.md` | any page, component, styling or UI copy |

## Rules

1. **Stay in your stream's paths** (table below). A change elsewhere goes to its owner as a request
   in the PR description or team chat. Never copy another stream's logic into your own code.
2. **Contracts are frozen after H2:** `src/lib/contracts.ts`, `src/lib/db/schema/**`,
   `db/migrations/**`, and the routes in `docs/architecture.md` §14. A change needs a PR labelled
   `contract`, merged by stream A and announced to the team.
3. **Invariants are not negotiable** (`docs/architecture.md` §2). In particular:
   - read documents only inside `withActor`;
   - the app connects as `trojanops_app`;
   - grants are recomputed per request and capped by the agent's max tier;
   - every run goes through `gateway.runAgent`;
   - write tools wait for a human;
   - distribution never widens;
   - time comes from `clock.now()`;
   - run input and output are private to the user who ran them.
4. **Code against interfaces.** Until another stream's piece is real, import it from its final path,
   where its owner merged a stub by H3 (table below). Don't build a local substitute.
5. **No retrieval, RAG or model calls before WP-13/WP-14.**
6. **Prove it.** Every change ships with tests or a demo-beat check, and `pnpm check` passes before
   the PR. Mark guesses `TODO(verify):`.
7. **Secrets and local files stay out of git:** `.env`, credentials, `.idea/`.

## Commands

| Command | Does |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm db:up` | `docker compose up -d db` |
| `pnpm db:reset` | drop, migrate and seed (owner URL, CLI only) |
| `pnpm db:generate` | `drizzle-kit generate` (stream A only) |
| `pnpm test` | Vitest, unit + DB integration |
| `pnpm check` | typecheck, lint, test, invariant greps and design greps |

## Streams and ownership

| Stream | Owner | Owns | Work packages |
|---|---|---|---|
| A Platform core | TBD | `src/lib/{contracts.ts,clock.ts,api.ts}`, `src/lib/{db,identity,authz,gateway,runtime}/**` (schema files `index`, `columns`, `orgs`, `runs`, `quota`, `audit`), `src/lib/connectors/llm/**`, `tests/db.ts`, `db/migrations/**`, `db/seed/quota.ts`, `src/app/{page.tsx,persona-picker.tsx}`, `scripts/**`, root config (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `next.config.*`, `drizzle.config.ts`, `vitest.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `docker-compose.yml`, `.env.example`) | WP-0 (lead), 1, 3, 4, 13 |
| B Distribution | TBD | `src/lib/distribution/**`, `src/lib/db/schema/distribution.ts`, `src/lib/lifecycle/transfer.ts`, `src/app/org/[orgId]/{page.tsx,club-home-*.ts*,catalog/**,admin/**}`, `src/app/usg/{templates,clubs,rule-packs}/**`, `db/seed/distribution.ts`, `rules/**` | WP-5, 7, 6 |
| C Documents and permissions | TBD | `src/lib/documents/**`, `src/lib/db/schema/documents.ts`, `src/components/inspector/**`, `src/app/org/[orgId]/{agents,documents,preview,audit}/**`, `src/app/usg/audit/**`, `db/seed/documents.ts`, `db/seed/docs/**` | WP-8, 9, 14 |
| D Integration and demo | TBD | `src/lib/connectors/**` (except `llm/`), `src/lib/utils.ts`, `src/lib/db/schema/connectors.ts`, `src/lib/lifecycle/import.ts`, `src/app/{layout.tsx,globals.css,fonts.ts}`, `src/components/{ui,shell}/**`, `src/app/{me,directory,demo}/**`, `src/app/usg/integrations/**`, `db/seed/{index,orgs,personas}.ts`, `db/seed/roster.csv` | WP-2, 10, 11, 12 |

- An API route under `src/app/api/**` belongs to the stream that owns the service it calls
  (`docs/architecture.md` §14).
- `tests/<area>.test.ts` belongs to the stream that owns the module it covers.
- `db/seed/ids.ts` (fixed seed ids) is shared and append-only: add ids for your area; never change
  an existing one.
- Shared docs (`README.md`, `docs/**`, `AGENTS.md`, `CLAUDE.md`): any stream may edit them, in the
  same PR as the change they describe.

## Interfaces between streams

Every stub is merged by **H3** at its real path, with the same name and signature and fixture data.
The owner replaces its internals by the "real" hour. Consumers never change their imports. Stub
fixture data lives in the owner's `fixtures.ts`; delete it once the function reads the database.

| Interface | Import from | Owner | Used by | Real by |
|---|---|---|---|---|
| contracts, schema | `@/lib/contracts`, `@/lib/db/schema` | A, with each area owner | all | H2 (frozen) |
| `withActor`, `now()` | `@/lib/db/with-actor`, `@/lib/clock` | A | all | H5 |
| `route()`, `parseBody()` | `@/lib/api` | A | every API route | real |
| `getActor()`, `grantsFor`, `capGrants`, `grantLabels` | `@/lib/identity`, `@/lib/authz` | A | B, C, D | H7 |
| `audit()`, `listAudit()` | `@/lib/gateway/audit` | A | all; C (audit views) | H9 |
| `runAgent()` (mock `RunResult`) | `@/lib/gateway` | A | C (agent page), D (directory runs) | H9 |
| `setLimit()`, `remaining()` | `@/lib/gateway/quota` | A | B (club and USG pages) | H11 |
| `effectiveAgent()`, `canUse()` | `@/lib/distribution` | B | A, C, D | H6 |
| `directory()`, `myAgents()`, `provisionOrg()`, `publishToAllStudents()` | `@/lib/distribution` | B | D | H7 |
| `transferPosition()` | `@/lib/lifecycle/transfer` | B | D (roster import) | H9 |
| `listAccessibleDocuments()`, `explainAccess()` | `@/lib/documents/access` | C | A (gateway step 5), C | H5 |
| `listLibraryDocuments()` | `@/lib/documents/library` | C | B (club home) | H6 |
| `previewAccess()` | `@/lib/documents/preview` | C | C | H10 |
| `<Inspector />` | `@/components/inspector` | C | D (run pages) | H10 |
| `getConnectors()`, `listConnectors()`, `RosterSource` | `@/lib/connectors/registry` | D | A, B | H9 |
| app shell, `src/components/ui/*` | `@/components/shell`, `@/components/ui/*` | D | all pages | H5 |

## Git

Branch per work-package slice: `<stream>/<wp>-<topic>`, e.g. `b/wp5-distribute`. Rebase on `main`,
keep PRs small, squash-merge. Commit messages use Conventional Commits with the area as scope:
`feat(distribution): distribute templates to a cohort`. Details: `docs/workflow.md`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
