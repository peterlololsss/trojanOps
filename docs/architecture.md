# TrojanOps architecture

## 1. Product

TrojanOps connects USC's existing systems (NetID, EngageSC, Trojan AI Gateway, club documents)
into one platform that gives every club governed AI:

- Clubs publish **public agents** for all students (recruiting Q&A, event Q&A) and use **internal
  agents** for their members and officers (handoff, minutes).
- Each student's `/me/agents` lists, per club, the agents that club exposes to them; the campus
  directory lists every club's public agents.
- USG distributes agent templates to clubs, sets quotas and club policy, and publishes rule packs.
- The platform gateway governs every agent run and tool call: identity → grants → audience check →
  quota → runtime → audit.
- Documents carry org-qualified grants; Postgres RLS decides what any user–agent pair can read.

Now: platform architecture. Last: agent implementation (model, retrieval, tools), on a mock runtime
until then.

| Term | 中文 | Meaning |
|---|---|---|
| directory | 全校智能体目录 | every club's public agents, `/directory` |
| catalog | 社团智能体库 | agents installed in or available to one club, `/org/[orgId]/catalog` |
| my agents | 我的智能体 | agents a student's clubs expose to them, `/me/agents` |
| audience | 受众 | who may use an agent: All students / All members / named positions |
| max tier | 可读上限 | highest document tier an agent may read: Public / Members / Officers / USG internal |
| persona | 演示人物 | a demo identity chosen in the persona switcher |
| platform gateway | 网关 | our server module; not the same thing as USC's Trojan AI Gateway |

Demo beats (each runs on real platform logic; agents answer through the mock runtime):

| # | Beat | Acceptance check |
|---|---|---|
| D1 | Integration panel | `/usg/integrations` lists the five connectors, each "Mock", with last sync. "Sync roster" imports Robotics Club from `roster.csv` and provisions it with the templates already distributed (`funding-precheck`); existing clubs report 0 changes |
| D2 | USG distributes | Avery distributes `event-planning` (default) to all clubs; it appears in all five catalogs, Robotics included. `funding-precheck` (required) is already there. Sam's attempt to give `event-planning` model class `standard` is rejected with the cap named and logged as `installation.rejected` |
| D3 | Club publishes a public agent | Startup's `recruiting-qa` starts disabled. Sam clicks "Publish to all students"; the confirmation states who gains access and the installation limit. It appears in `/directory`; Lee (no club) opens it; the inspector lists Startup's public documents only |
| D4 | Internal vs public scope | Casey's `/me/agents`: `handoff` (All members), `recruiting-qa` (All students). Taylor's adds `funding-precheck` (Treasurer, President). Sam's preview of `handoff`: Member → minutes allowed, budget "Not granted"; Treasurer → both; preview of `recruiting-qa`: "Any signed-in student" → recruiting FAQ only, minutes "Outside agent sources" |
| D5 | Quota | Sam sets Casey's limit to $0.00 → Casey's next `handoff` run is blocked before the runtime is called. Lee (seeded with $0.04 today) runs `recruiting-qa` once ($0.01, billed to Startup); the next run hits the $0.05 student daily cap |
| D6 | Rule pack update | Avery publishes `usg-funding` v2 (annual cap $8,000 → $10,000); the next `funding-precheck` run in any club shows "Demo rule pack v2 · annual cap $10,000" |
| D7 | Succession | Sam transfers treasurer from Taylor to Jordan. Taylor's `/me/agents` drops `funding-precheck`; Jordan's gains it; installations and documents are unchanged |
| D8 | Audit | Every beat above is in the log, including the rejected widening. The USG view shows metadata only; documents the viewer can't read show as "Restricted document" |

Not now: retrieval/RAG code, model calls (until WP-13), real USC integrations, mobile layout,
production deploy.

## 2. Invariants

- **I1.** Documents are read only inside `withActor()`: a transaction that first runs
  `set_config('app.user_id'|'app.grants'|'app.agent_sources'|'app.manage_org'|'app.max_tier', …, true)`.
- **I2.** The app connects as `trojanops_app`: not superuser, not table owner, `NOBYPASSRLS`. RLS is
  enabled and forced on `documents` and `agent_runs`. Only the migration and seed CLI uses
  `DATABASE_OWNER_URL`; no route does.
- **I3.** Grants are org-qualified strings recomputed on every request from active memberships in
  the active org: `*`, `<orgId>:*`, `<orgId>:<position>`. Never stored in a cookie or JWT; never
  include positions held in other orgs. Document-library reads recompute a separate scope for the
  viewed org (§10, decision 16), containing only memberships held in that org.
- **I4.** Run grants are capped by the agent's max tier: `public` → `['*']`; `members` →
  `userGrants ∩ ['*', '<orgId>:*']`; `officers` → `userGrants`. An agent whose audience is `public`
  always has max tier `public`.
- **I5.** Every agent run goes through `gateway.runAgent()`. The runtime and model calls sit behind
  `AgentRuntime` and `LLMProvider`; vendor SDKs are imported only under `src/lib/connectors/llm/`.
- **I6.** Write tools never execute from a model call: they become `pending_actions` that a human
  confirms on the run page.
- **I7.** Distribution never widens: an installation's audience, max tier, tools, model class and
  `usable_by` stay within its template version; model classes stay within `usg_club_policy`; a
  public audience needs `usg_club_policy.allow_public_agents`; extra sources must belong to the
  club. `clamps.ts` checks on every write and again at run time.
- **I8.** `ai_usage` and `audit_events` are append-only. Audit `details` hold ids and numbers,
  never document text or run input/output.
- **I9.** Time comes from `clock.now()`: real time, or in `DEMO_MODE` the `DEMO_NOW` value plus the
  time elapsed since the process started or since `/api/demo/clock` last set it.
- **I10.** Quota: child ≤ parent on write. Every run checks platform, billed club and installation;
  the member limit for any run by an active member of the billed club, whatever the audience; and
  the student daily cap for every public-agent run. Limits are read from the DB on every run.
- **I11.** Every action in §12 writes one audit row.
- **I12.** Integrations go only through connector interfaces (§9); the integration panel shows which
  implementation is live.
- **I13.** Demo data only: fictional people and clubs.
- **I14.** The gateway is a server module on the Node.js runtime, not Next.js middleware.
- **I15.** A run's input and output are readable only by the user who ran it; club and USG views
  read run metadata only.

## 3. Stack, commands, environment

- Next.js (App Router) + TypeScript, pnpm, Tailwind + shadcn/ui.
- PostgreSQL 17 in Docker (`pgvector/pgvector:pg17`, so vectors are available later).
- Drizzle ORM + drizzle-kit; roles, grants, RLS and triggers in a custom SQL migration
  (`drizzle-kit generate --custom --name roles_rls`).
- Zod for request validation. Vitest for unit and DB integration tests.

| Command | Does |
|---|---|
| `pnpm dev` | Next.js dev server |
| `pnpm db:up` | `docker compose up -d db` |
| `pnpm db:reset` | drop the `public` and `drizzle` schemas, migrate, seed (owner URL; CLI only) |
| `pnpm test` | Vitest, unit + DB integration |
| `pnpm check` | typecheck, lint, test, invariant greps (I5, I9) and design greps (`.claude/agents/ui-designer.md`) |

`.env.example`:

```bash
DATABASE_URL=postgres://trojanops_app:app@localhost:5432/trojanops         # app role, RLS applies
DATABASE_OWNER_URL=postgres://postgres:postgres@localhost:5432/trojanops   # migrate and seed CLI only
SESSION_SECRET=change-me
DEMO_MODE=1                       # persona switcher, inspector extras, /demo
DEMO_NOW=2026-11-15T10:00:00-08:00
AGENT_RUNTIME=mock                # mock | real (WP-13); read at startup
CONNECTOR_IDENTITY=persona        # persona | netid
CONNECTOR_ROSTER=csv              # csv | engagesc
CONNECTOR_DOCUMENTS=upload        # upload | <future source>
CONNECTOR_LLM=mock                # mock | <chosen provider> (WP-13)
CONNECTOR_APPLICATIONS=internal   # internal | engagesc
```

## 4. Repo layout

The letter after each path is the owning stream (`AGENTS.md`). An API route under
`src/app/api/**` belongs to the stream that owns the service it calls (§14).

```text
src/lib/
  contracts.ts, clock.ts, api.ts (route helper)                            A
  runtime/       index.ts (AGENT_RUNTIME), mock.ts                          A
  utils.ts (shadcn cn)                                                      D
  db/            client.ts (app role), with-actor.ts                        A
  db/schema/     index.ts, columns.ts, orgs.ts, runs.ts, quota.ts, audit.ts A
                 distribution.ts                                            B
                 documents.ts                                               C
                 connectors.ts                                              D
  identity/  authz/  gateway/  runtime/                                     A
  distribution/  catalog, publish, distribute, install, provision, directory,
                 my-agents, effective-config, clamps                        B
  lifecycle/     transfer.ts                                                B
                 import.ts                                                  D
  documents/     library.ts, access.ts (listAccessibleDocuments, explainAccess), preview.ts   C
  connectors/    registry.ts + one folder per kind, each with mock.ts       D
                 llm/**                                                     A
src/components/  ui/ (shadcn, restyled), shell/ (masthead, side nav, footer)   D
                 inspector/                                                 C
src/app/         layout.tsx, globals.css, fonts.ts                          D
                 pages: the stream named in §14
db/migrations/   generated only by A
db/seed/         ids.ts: fixed seed ids, shared and append-only
                 index.ts, orgs.ts, personas.ts, roster.csv                 D
                 distribution.ts                                            B
                 documents.ts, docs/*.md                                    C
                 quota.ts                                                   A
rules/packs/     usg-funding.v1.json                                        B
tests/           <area>.test.ts, owned by the stream of the module it covers
                 db.ts: app-role helpers; DB suites skip when the DB is down  A
scripts/         db-reset.ts (owner URL), check.ts                          A
```

Until an interface is real, its stub reads fixtures from the owner's `fixtures.ts` built on
`db/seed/ids.ts`.

## 5. Data model and RLS

Every id is `uuid default gen_random_uuid()`; every table has `created_at` written from `clock.now()`.

### Orgs and people (A)

- `orgs(id, kind text check (kind in ('usg','rso')), slug text unique, name text, status text check (status in ('active','inactive')))`
- `org_cohorts(cohort_slug text, org_id → orgs, primary key (cohort_slug, org_id))`
- `users(id, external_id text unique, display_name text, demo_email text)`
- `positions(id, org_id → orgs, slug text, name text, is_officer bool, unique (org_id, slug))`
- `memberships(id, user_id, org_id, position_id, source text check (source in ('roster','manual')), started_at, ended_at null)`; active = `ended_at is null`
- `roster_state(org_id, position_slug, external_user_id, imported_at, primary key (org_id, position_slug, external_user_id))`: the holders of each position as last imported (§13); several rows for a position with several holders, such as `member`

### Documents (C)

- `sources(id, org_id, slug, name, kind text check (kind in ('public','minutes','finance','archive','rulebook','usg_internal')), unique (org_id, slug), unique (id, org_id))`
- `documents(id, org_id, source_id, title, tier text check (tier in ('public','members','officers','usg_internal')), allowed_positions text[], read_grants text[], version int, body_md text, uploaded_by, foreign key (source_id, org_id) → sources(id, org_id))`: a document's source belongs to its org, so a president can't plant documents in another org's source
  - A trigger sets `read_grants` from `tier` and `allowed_positions` on every insert and update; for
    `officers` it always includes `<orgId>:president`. Code never writes `read_grants`.

### Distribution (B)

- `agent_templates(id, slug text unique, name text, publisher_org_id, scope text check (scope in ('global','org')), distribution text check (distribution in ('required','default','optional')), target text default 'all', status text check (status in ('active','retired')), latest_version int, distributed_at timestamptz null)`
- `agent_template_versions(id, template_id, version int, purpose text, audience text check (audience in ('public','members','positions')), usable_by text[], max_tier text, source_kinds text[], tools text[], model_classes text[], default_model_class text, system_prompt text, rule_pack_slug text null, changelog text, published_by, published_at, unique (template_id, version))`
- `agent_installations(id, template_id, org_id, enabled bool, track text check (track in ('latest','pinned')), pinned_version int null, audience text null, usable_by text[] null, prompt_addendum text, extra_source_ids uuid[], model_class text null, installed_by, installed_at, unique (template_id, org_id))`
- `rule_packs(id, slug text, version int, status text check (status in ('draft','published')), label text, content jsonb, published_by, published_at, unique (slug, version))`
- `usg_club_policy(org_id primary key, allowed_model_classes text[], allow_public_agents bool default true)`

### Runs, quota, audit (A) and connectors (D)

- `agent_runs(id, installation_id, template_version int, rule_pack_version int null, org_id, billed_org_id, user_id, input text, output jsonb, accessible_document_ids uuid[], cited_document_ids uuid[], model text, cost_micro bigint, status text, started_at, finished_at)`
  - RLS: select only where `user_id::text = current_setting('app.user_id', true)`.
  - View `agent_runs_meta` (every column except `input` and `output`) for club and USG pages,
    filtered by org in the service.
- `pending_actions(id, run_id, org_id, user_id, tool text, args jsonb, status text check (status in ('pending','confirmed','rejected')), confirmed_by null, confirmed_at null)`
- `quota_limits(id, scope text check (scope in ('platform','org','member','installation','student_daily')), org_id null, user_id null, installation_id null, limit_micro bigint, set_by, set_at)`
- `ai_usage(id, run_id, billed_org_id, user_id, installation_id, is_public bool, model text, kind text check (kind in ('hold','settle','release')), amount_micro bigint, created_at)`
- `audit_events(id bigserial, ts, actor_user_id null, acting_org_id null, action text, run_id null, installation_id null, target_type text, target_id text, details jsonb)`
- `connectors(kind text primary key, implementation text, status text, last_sync_at timestamptz null, details jsonb)` (D)

### Grants

| Tier | `read_grants` (trigger) |
|---|---|
| `public` | `{'*'}` |
| `members` | `{'<orgId>:*'}` |
| `officers` | `{'<orgId>:president'}` ∪ `{'<orgId>:<p>'}` for each `p` in `allowed_positions` |
| `usg_internal` | `{'<usgId>:reviewer', '<usgId>:admin'}` |

| Agent max tier | `capGrants(userGrants, orgId)` |
|---|---|
| `public` | `['*']` |
| `members` | `userGrants ∩ ['*', '<orgId>:*']` |
| `officers` | `userGrants` |
| `usg_internal` | `userGrants` (USG org only) |

RLS also enforces the agent's document tier ceiling through transaction-local `app.max_tier`:
`public` < `members` < `officers` < `usg_internal`. A role may grant documents at several tiers,
so retaining its grant at the officers cap still requires the database tier check. Library reads
omit the agent ceiling and use the viewer's grants and source scope.

### Roles, RLS and triggers (custom migration, after the tables exist)

```sql
do $$ begin
  if not exists (select from pg_roles where rolname = 'trojanops_app') then
    create role trojanops_app login password 'app' nosuperuser nobypassrls;
  end if;
end $$;
grant usage on schema public to trojanops_app;
grant select, insert, update on all tables in schema public to trojanops_app;
grant usage, select on all sequences in schema public to trojanops_app;
revoke update, delete on audit_events, ai_usage from trojanops_app;

create or replace function app_setting_array(name text) returns text[] language sql stable as $$
  select coalesce(nullif(current_setting(name, true), ''), '{}')::text[] $$;

alter table documents enable row level security;
alter table documents force row level security;
create policy documents_read on documents for select to trojanops_app using (
  read_grants && app_setting_array('app.grants')
  and source_id::text = any (app_setting_array('app.agent_sources'))
  and app_document_tier_rank(tier) <= app_document_tier_rank(
    coalesce(nullif(current_setting('app.max_tier', true), ''), 'usg_internal')));
create policy documents_insert on documents for insert to trojanops_app
  with check (org_id::text = current_setting('app.manage_org', true));
create policy documents_update on documents for update to trojanops_app
  using (org_id::text = current_setting('app.manage_org', true))
  with check (org_id::text = current_setting('app.manage_org', true));

alter table agent_runs enable row level security;
alter table agent_runs force row level security;
create policy runs_own on agent_runs for all to trojanops_app
  using (user_id::text = current_setting('app.user_id', true))
  with check (user_id::text = current_setting('app.user_id', true));
```

- The same migration (`0001_roles_rls.sql`) also:
  - grants the same privileges on future tables through `alter default privileges`;
  - creates the `documents_read_grants` trigger (`before insert or update`) from the grants table
    above;
  - creates the view `agent_runs_meta`. It runs with its owner's rights, so it lists every run;
    services filter it by org. Because a simple view is updatable as its owner, the migration
    revokes insert and update on it; revoke them on any future view too.
- `audit_events.ts` is that table's `created_at`.
- `withActor` sets `app.manage_org` to the active org only when the actor is its president.
- `0002_document_tier_ceiling.sql` adds `app_document_tier_rank` and the tier predicate above to
  the existing policy. `withActor` sets `app.max_tier` on every transaction; an omitted ceiling
  permits all tiers subject to grants and sources. An invalid nonempty ceiling permits no rows.
- An `UPDATE ... WHERE` on `documents` must also pass `documents_read`, so the library sets
  `app.grants` and `app.agent_sources` before updating.
- Agent runs set `app.agent_sources` to the agent's sources. The document library sets it to all
  sources of the viewed org plus USG public sources, with the actor's grants in that org.
- `pnpm db:reset` drops the `public` and `drizzle` schemas; the role survives and the `do` block
  skips it.
- Never add a `for all ... using (true)` policy: permissive policies are OR-ed.
- `INSERT ... RETURNING` needs SELECT access to the new row; generate ids in app code.

## 6. Contracts (`src/lib/contracts.ts`)

```ts
export type Grant = '*' | `${string}:*` | `${string}:${string}`;
export type Tier = 'public' | 'members' | 'officers' | 'usg_internal';
export type Audience = 'public' | 'members' | 'positions';
export type ModelClass = 'standard' | 'economy';
export type AccessCell = 'allowed' | 'not_granted' | 'outside_sources' | 'above_max_tier';

export interface Actor {
  userId: string | null;          // null only on public pages before sign-in; runs require a user
  activeOrgId: string | null;     // null = acting as a student outside any club
  positions: string[];            // slugs held in activeOrgId only
  grants: Grant[];                // grantsFor(); never persisted
}

export interface EffectiveAgent {
  installationId: string;
  orgId: string;                  // club that owns the installation; billed for every run
  templateSlug: string;
  name: string;
  templateVersion: number;
  status: 'enabled' | 'disabled' | 'retired';  // gateway step 1 refuses anything but 'enabled'
  purpose: string;
  audience: Audience;
  usableBy: string[];             // position slugs; empty unless audience = 'positions'
  maxTier: Tier;
  sourceIds: string[];
  tools: string[];
  modelClass: ModelClass;
  systemPrompt: string;
  rulePack?: { slug: string; version: number; label: string; content: unknown };
}

// distribution: positions are read in agent.orgId, not in the actor's active org.
// Implemented in src/lib/distribution/effective-config.ts.
export type CanUseResult =
  | { ok: true; reason: 'public' | 'members' | { position: string } }
  | { ok: false };
export type CanUse = (userId: string, agent: EffectiveAgent) => Promise<CanUseResult>;

export interface AccessibleDocument { id: string; title: string; tier: Tier; bodyMd: string }

// The document library (C → B club home): documents the actor can read in one club.
export interface LibraryDocument {
  id: string;
  title: string;
  tier: Tier;
  sourceId: string;
  sourceName: string;
  version: number;
  createdAt: Date;
}

export interface AgentRuntime {
  run(agent: EffectiveAgent, actor: Actor, input: string, ctx: {
    runId: string;
    accessibleDocuments: AccessibleDocument[];
  }): Promise<AgentResult>;
}

export interface AgentResult {
  reply: string;
  citations: Array<{ documentId: string; quote: string }>;
  proposedActions: Array<{ tool: string; args: unknown }>;
  usage: { model: string; inputTokens: number; outputTokens: number; costMicro?: number };
}

export interface RunInspector {
  runGrants: Array<{ grant: Grant; label: string }>;      // label e.g. "Startup Club · Treasurer"
  sources: Array<{ id: string; name: string }>;
  permitted: Array<{ id: string; title: string; tier: Tier }>;
  readInRun: Array<{ id: string; title: string }>;        // cited documents
  blocked?: Array<{ id: string; title: string | null; reason: AccessCell }>;  // only when the viewer manages the club; null title = "Restricted document"
  templateVersion: number;
  rulePack?: { label: string; version: number };
  billedClub: string;
  costMicro: number;
  quotaRemainingMicro: Record<string, number>;
  auditEventId: number;
}

export interface RunResult {
  runId: string;
  reply: string;
  citations: Array<{ documentId: string; quote: string }>;
  pendingActions: Array<{ id: string; tool: string }>;
  inspector: RunInspector;
}

export interface PreviewMatrix {
  subjects: Array<{ key: string; label: string }>;          // positions, "Member", "Any signed-in student"
  documents: Array<{ id: string; title: string; tier: Tier; source: string }>;
  cells: Record<string, Record<string, AccessCell>>;        // subjectKey → documentId → cell
}

// Distribution read models (B → D)
export interface AgentListing {
  installationId: string;
  orgId: string;
  orgName: string;
  templateSlug: string;
  name: string;
  purpose: string;
  audience: Audience;
  reasonLabel: string;            // "All students", "All members", or position names ("Treasurer, President")
  templateVersion: number;
}

export interface MyAgentsClub {
  orgId: string;
  orgName: string;
  positionNames: string[];        // the user's positions in this club
  agents: AgentListing[];
}

// Quota (§11)
export type QuotaScope = 'platform' | 'org' | 'member' | 'installation' | 'student_daily';

export interface QuotaTarget {
  scope: QuotaScope;
  orgId?: string;
  userId?: string;
  installationId?: string;
}

export interface QuotaRemaining {
  scope: QuotaScope;
  limitMicro: number;
  spentMicro: number;
  remainingMicro: number;
}

// Audit (§12)
export type AuditAction =
  | 'agent.run' | 'run.access' | 'tool.call' | 'tool.confirm'
  | 'authz.denied' | 'quota.blocked' | 'quota.limit.set'
  | 'template.publish' | 'template.distribute' | 'template.retire'
  | 'installation.update' | 'installation.rejected' | 'agent.publish_public'
  | 'org.provision' | 'roster.import' | 'connector.sync' | 'position.transfer'
  | 'rule_pack.publish' | 'document.upload';

export interface AuditEvent {
  actorUserId: string | null;
  actingOrgId: string | null;
  runId?: string;
  installationId?: string;
  targetType: string;
  targetId: string;
  details: Record<string, string | number | boolean | null | string[] | number[]>;  // ids and numbers only (I8)
}

export interface AuditEntry extends AuditEvent {
  id: number;
  ts: Date;
  action: AuditAction;
}

export interface ApiError {
  code: 'unauthenticated' | 'forbidden' | 'quota_exceeded' | 'clamp_violation' | 'not_found' | 'invalid';
  message: string;                                          // UI copy, §11
  cap?: { scope: string; limitMicro?: number; spentMicro?: number; field?: string; allowed?: unknown };
}

const STATUS: Record<ApiError['code'], number> = {
  unauthenticated: 401,
  forbidden: 403,
  quota_exceeded: 429,
  clamp_violation: 422,
  not_found: 404,
  invalid: 400,
};

/** Thrown by services; `route()` in src/lib/api.ts turns it into a JSON ApiError. */
export class AppError extends Error {
  readonly status: number;
  constructor(readonly error: ApiError) {
    super(error.message);
    this.name = 'AppError';
    this.status = STATUS[error.code];
  }
}

// Connectors (§9)
export type ConnectorKind = 'identity' | 'roster' | 'documents' | 'llm' | 'applications';

export interface ConnectorStatus {
  kind: ConnectorKind;
  implementation: string;         // "mock", "csv", "persona", …
  isMock: boolean;
  status: 'ok' | 'degraded' | 'down';
  lastSyncAt: Date | null;
}

export interface IdentityProvider { currentUserId(req: Request): Promise<string | null> }
export interface RosterRow {
  orgSlug: string;
  orgName: string;
  externalUserId: string;
  userDisplayName: string;
  position: string;
}
export interface RosterSource { fetch(): Promise<RosterRow[]> }
export interface DocumentSource {           // imports from external stores; uploads go through documents.library
  list(orgId: string): Promise<Array<{ externalId: string; title: string }>>;
  read(externalId: string): Promise<{ title: string; bodyMd: string }>;
}
export interface ApplicationSink { submit(application: unknown): Promise<{ externalId: string }> }
export interface LLMProvider {              // used by the real runtime (WP-13)
  complete(req: unknown): Promise<unknown>;
  priceUsdPerMTok(model: string): { input: number; output: number };
}
```

## 7. Gateway: `runAgent(actor, installationId, input)`

1. `agent = effectiveAgent(installationId)` (§8). Refuse retired templates and disabled
   installations with a reason. Runs need a signed-in user. Internal agents need
   `actor.activeOrgId = agent.orgId`; "Open" on `/me/agents` switches the active org first. Public
   agents can be run from the directory with any active org.
2. `canUse(actor.userId, agent)`. Otherwise `authz.denied`, 403 `forbidden`.
3. `runGrants = capGrants(grantsFor(actor.userId, agent.orgId), agent.orgId, agent.maxTier)`.
4. Quota: hold = the estimated cost (mock: a flat $0.01). Block when `spent + hold > limit` at any
   level; a limit of 0 always blocks. Levels (checked in the order given in §11): platform; billed
   club (`agent.orgId`); installation; member, when the user is an active member of the billed club;
   `student_daily`, for every public-agent run. Blocked → `quota.blocked`, 429 `quota_exceeded` with
   `cap`; runtime not called.
5. `accessibleDocuments = listAccessibleDocuments(actor, runGrants, agent)` (C, via
   `withActor`); `audit('run.access', {documentIds})`.
6. `runtime.run(agent, actor, input, {runId, accessibleDocuments})`.
7. `proposedActions`: write tools become `pending_actions`, confirmed on the run page; read and
   draft tools run through `gateway.tool()` once real agents exist.
8. Settle quota with the actual cost, update `agent_runs`, `audit('agent.run', {runId, costMicro})`,
   return `RunResult`. `inspector.blocked` is filled only when the viewer is the club's president
   or a USG admin, with titles resolved under the viewer's own RLS.

Mock runtime (`runtime/mock.ts`):
- The reply lists the accessible documents.
- Citations quote the first sentence of up to three accessible documents.
- With a rule pack, the reply adds "<label> v<version> · annual cap $<value>".
- Cost is a flat $0.01. No model call.

## 8. Agent distribution

| Direction | Publisher | Users | Examples |
|---|---|---|---|
| USG → clubs | USG (`global` template) | positions or all members of each club | `funding-precheck`, `event-planning` |
| Club → its members | club (`org` template) | all members or named positions | `handoff`, `minutes` |
| Club → all students | club installation with audience `public` | any signed-in student | `recruiting-qa`, `showcase-qa` |

- **Publish:** `publishVersion(templateId, draft)` by a USG admin (global) or the club president
  (own templates) inserts version n+1 and sets `latest_version`. `audit('template.publish')`.
- **Distribute:** `distribute(templateId)` (USG; `required` or `default`) sets `distributed_at` and
  upserts an installation (`track='latest'`, `enabled=true`) in every active club in `target` (`all`
  or a cohort). Existing overrides are kept; `required` forces `enabled=true`. Idempotent.
  `optional` templates are only listed in the catalog. `audit('template.distribute', {count})`.
- **Club changes:** `updateInstallation` (president): enable/disable (not `required`), pin, narrow
  the audience, set `usable_by`, add own sources, prompt addendum, model class, installation quota.
  `audit('installation.update')`; a clamp violation returns `clamp_violation` and writes
  `audit('installation.rejected', {field, allowed})`.
- **Publish to all students:** on an installation row, sets audience `public` and enables it.
  - Needs `usg_club_policy.allow_public_agents`, max tier `public`, and an installation limit:
    the president's figure, else the one the installation already has, else half the club's
    monthly quota. A club with no monthly quota is refused (`invalid`).
  - The confirmation names who gains access, the readable document count and the limit.
  - `audit('agent.publish_public')`.
  - Never cut.
- **Club-built agents:** `createClubTemplate(orgId, {fromTemplateId?})` forks or starts blank, then
  publish + install. Its UI is cut first when behind; the seed creates the club-built agents.
- **Directory:** `directory()` returns enabled installations whose effective audience is `public`,
  grouped by club and purpose.
- **My agents:** `myAgents(userId)` returns, for each distinct org where the user has an active
  membership, that club's enabled installations that `canUse` admits, each with its reason label
  ("All students", "All members", or the position names).
- **Propagation:** `latest` installations resolve the template's latest version at run time;
  `pinned` ones keep theirs and show "Update available". Runs use the latest published rule pack.
  `retire(templateId)` blocks runs with "Retired by USG".
- **Provisioning:** `provisionOrg(orgId)` installs only templates with `distributed_at` set whose
  target includes the club.

Clamps (`clamps.ts`):

| Field | Rule |
|---|---|
| audience | breadth `public` > `members` > `positions`; installation ≤ version, and `public` needs `allow_public_agents` |
| `usable_by` | for a `positions` version, ⊆ the version's list; for a `members` or `public` version, any of the club's positions |
| max tier | `public` audience ⇒ `public`; never above the version |
| sources | version `source_kinds` resolved in the club (USG org for `rulebook`, `usg_internal`) plus extra sources owned by the club; RLS caps tiers at run time |
| tools, model class | ⊆ the version; model class also ∩ `usg_club_policy.allowed_model_classes` |
| installation quota | ≤ the club's quota |

Seeded templates (display names in UI copy):

| slug | Name | Publisher | Distribution | Audience / usable_by | Max tier | Source kinds |
|---|---|---|---|---|---|---|
| `funding-precheck` | Funding pre-check | USG | required, all; distributed in the seed | positions: treasurer, president | officers | rulebook, finance; rule pack `usg-funding` |
| `event-planning` | Event planning | USG | default; v1 published, not distributed (D2 distributes it) | positions: president, secretary | members | archive, minutes |
| `recruiting-qa` | Recruiting Q&A | Startup | installation seeded **disabled**, audience public | public | public | public |
| `showcase-qa` | Showcase Q&A | Dance | enabled, public | public | public | public |
| `handoff` | Club handoff | Startup | enabled | members | officers | public, minutes, archive, finance |
| `usg-review-assistant` | USG review assistant | USG (org) | enabled in USG | positions: reviewer, admin | usg_internal | rulebook, usg_internal |

## 9. Integration layer

| Kind | Interface | Hackathon implementation | Real system |
|---|---|---|---|
| `identity` | `IdentityProvider` | persona cookie | USC NetID SSO |
| `roster` | `RosterSource` | `db/seed/roster.csv` | EngageSC directory and officer lists |
| `documents` | `DocumentSource` | none: uploads go through `documents.library` | clubs' existing document stores |
| `llm` | `LLMProvider` | mock | Trojan AI Gateway, or the chosen provider (WP-13) |
| `applications` | `ApplicationSink` | internal queue | EngageSC funding applications |

- USG rule text is not a connector: USG keeps it as rule packs in `/usg/rule-packs`.
- `connectors/registry.ts` picks each implementation from `CONNECTOR_*` and records it in
  `connectors`. `/usg/integrations` shows kind, implementation, status and last sync.
- "Sync roster" runs `importRoster()` (§13) and writes `audit('connector.sync', {changes})`.

## 10. Documents and permissions

- **Upload** (`documents/library.ts`): only the club president (`app.manage_org`). Choose source,
  tier and, for `officers`, positions. The trigger computes `read_grants`. `audit('document.upload')`.
- **`listAccessibleDocuments(actor, runGrants, agent)`** (`documents/access.ts`): the RLS query
  used by the gateway's step 5. `agent` requires `sourceIds` and `maxTier`; the query runs as
  `withActor(actor, {grants: runGrants, sourceIds: agent.sourceIds, maxTier: agent.maxTier})`.
- **`listLibraryDocuments(actor, orgId)`** (`documents/library.ts`): the club library and the club
  home's recent documents.
- **`explainAccess(subjectGrants, agent, doc)`**: a pure function returning an `AccessCell`:
  1. `outside_sources` when the doc's source isn't the agent's;
  2. `above_max_tier` when the doc's tier is above the agent's max tier;
  3. `not_granted` when no grant matches;
  4. `allowed` otherwise.
  - A test asserts it agrees with `listAccessibleDocuments` for every persona × agent × document
    in the seed.
- **`previewAccess(viewer, installationId)`** returns a `PreviewMatrix`, president only.
  - Rows: "Any signed-in student", "Member", and each club position.
  - Columns: every document the viewer can read in the club, plus the USG rulebook.
  - Cells come from `explainAccess`.
- Visibility contract (`tests/rls.test.ts`), as `trojanops_app`:

| Actor · agent | Recruiting FAQ | Minutes | Spring budget | USG funding rules |
|---|---|---|---|---|
| Lee (no club) · `recruiting-qa` | yes | no | no | no |
| Taylor (treasurer) · `recruiting-qa` | yes | no | no | no |
| Casey (member) · `handoff` | yes | yes | no | no |
| Taylor (treasurer) · `handoff` | yes | yes | yes | no |
| Morgan (Archery treasurer, Startup member) · `handoff` | yes | yes | no | no |
| Taylor (treasurer) · `funding-precheck` | no | no | yes | yes |

  Also: no `set_config` → zero rows; a non-president can't insert or update documents; no route
  imports the owner URL.

## 11. Quota

- Unit: micro-USD. Month: calendar month in `America/Los_Angeles`; `student_daily` resets at midnight
  PT.
- Levels: platform → club → member; per installation; `student_daily` for public-agent runs (set by
  USG). Every public installation has an installation limit.
- `PUT /api/quota/limits` validates child ≤ parent (club ≤ platform; member and installation ≤ club;
  `student_daily` has no parent) and returns `clamp_violation` naming the parent.
  `audit('quota.limit.set')`.
- Mechanics: hold → settle (actual − hold) → stale holds released after 10 minutes, all as
  `ai_usage` rows; spent = sum since the period start.
  - Amounts: a hold is +H, a settle is (actual − H), a release is −H. A finished run nets to its cost; a
    failed or stale one nets to 0. A settle after a release writes +actual.
  - A level with no limit row: platform, club and `student_daily` count as 0 (they block); member and
    installation fall back to the club's limit.
  - Checks run in this order and the first failure is reported: member, `student_daily`, installation,
    club, platform. A blocked run writes `quota.blocked` and no run row.
  - `setLimit` writes under an advisory lock; lowering a parent does not change its children, because a
    run checks every level.
- `POST /api/pending-actions/:id/confirm` (body `{}`): the user who ran the agent confirms, holding an
  active membership in the action's club. A tool with an entry in `confirmerPositions`
  (`gateway/tools.ts`) narrows that to the listed positions; a tool with no entry accepts any member
  of the club. The run's active org is not required: a public agent can be run from another club.
  It records `tool.confirm`; no write tool executes yet.
- `RunResult.inspector.quotaRemainingMicro` holds `{[billed club name]: n}`, where n is the smallest
  remaining amount over the levels that apply to the run (member, `student_daily`, installation, club,
  platform).

UI copy for `quota_exceeded`, by scope:

| Scope | Message |
|---|---|
| `member` | "Your monthly AI quota in {club} is used up (${spent} of ${limit}). Ask your president to raise it." |
| `org` | "{club} has used its monthly AI quota (${spent} of ${limit}). USG can raise it." |
| `installation` | "{agent} has used its monthly budget in {club}." |
| `student_daily` | "You've reached today's limit for public agents (${limit}). It resets at midnight PT." |
| `platform` | "TrojanOps has reached this month's platform limit." |

## 12. Audit

`audit()` in `gateway/audit.ts` is the only writer; `details` hold ids and numbers only. Actions:

- `agent.run`, `run.access`, `tool.call`, `tool.confirm`
- `authz.denied`, `quota.blocked`, `quota.limit.set`
- `template.publish`, `template.distribute`, `template.retire`
- `installation.update`, `installation.rejected`, `agent.publish_public`
- `org.provision`, `roster.import`, `connector.sync`, `position.transfer`
- `rule_pack.publish`, `document.upload`

USG admins see all metadata; presidents see their club. Document ids resolve to titles under the
viewer's RLS; unreadable ones render as "Restricted document".

## 13. Lifecycle and rollout

- **`importRoster()`:** rows from `RosterSource` → upsert orgs, users (by `externalUserId`),
  positions and memberships. New clubs get `provisionOrg()`:
  - default sources (`public`, `minutes`, `finance`, `archive`);
  - installations of distributed templates;
  - the default club quota and `usg_club_policy`.
- **Precedence:** a roster row changes a position only when it differs from `roster_state` for that
  position. A manual transfer therefore holds until the roster itself changes that position.
  - Test: a sync right after a manual transfer changes nothing.
- **`roster.csv`** mirrors the seed for existing clubs and adds one new club (Robotics Club). The
  seed (`db/seed/personas.ts`, D) writes `roster_state` to match, so the first sync changes nothing
  in existing clubs.
- **`transferPosition(actor, orgId, slug, toUserId)`:** end the old membership row and insert the new one
  (`source = 'manual'`) in one transaction. `audit('position.transfer')`.
- **Cohorts** are seeded; editing them is P1.
- **Inactive clubs:** installations disabled; documents and audit kept.

## 14. Routes and pages

Every handler: `const actor = await getActor(req)` → one service call → JSON or `ApiError`.

| Method and path | Service | Who | Stream |
|---|---|---|---|
| POST `/api/session/persona`, POST `/api/session/active-org`, GET `/api/me` | identity | `DEMO_MODE` / any | A |
| POST `/api/agents/:installationId/runs` | `gateway.runAgent` | per audience | A |
| POST `/api/pending-actions/:id/confirm` (body `{}`) | `gateway.confirm` | the run's user, a member of the action's club (narrowed per tool) | A |
| PUT `/api/quota/limits` | `quota.setLimit` | USG admin (platform, org, student_daily), president (member, installation) | A |
| GET `/api/audit` | `audit.list` | president (own club), USG admin | A |
| GET `/api/directory`, GET `/api/me/agents` | `distribution.directory`, `myAgents` | signed-in users | B |
| GET `/api/orgs/:orgId/catalog`, POST/PATCH `/api/orgs/:orgId/installations[/:id]` | `distribution.*` | members (read), president (write) | B |
| POST `/api/orgs/:orgId/installations/:id/publish` | `distribution.publishToAllStudents` | president | B |
| POST `/api/orgs/:orgId/templates` | `distribution.createClubTemplate` | president | B |
| GET/PATCH `/api/usg/templates/:id`, POST `/api/templates/:id/versions` | `distribution.*` | USG admin (global), president (own) | B |
| POST `/api/usg/templates/:id/distribute`, POST `/api/usg/templates/:id/retire` | `distribution.*` | USG admin | B |
| PUT `/api/usg/club-policy/:orgId` | `distribution.setClubPolicy` | USG admin | B |
| POST `/api/usg/rule-packs/:slug/versions` | `rules.publish` | USG admin | B |
| POST `/api/orgs/:orgId/positions/:slug/transfer` | `lifecycle.transferPosition` | president | B |
| GET/POST `/api/orgs/:orgId/documents` | `documents.library` | members (read via RLS), president (upload) | C |
| GET `/api/orgs/:orgId/preview?installation=` | `documents.previewAccess` | president | C |
| POST `/api/usg/connectors/roster/sync` | `lifecycle.importRoster` | USG admin | D |
| POST `/api/demo/clock` | demo | `DEMO_MODE` only | D |

Pages (18):

| Page | Stream |
|---|---|
| `/` persona switcher | A |
| `/org/[orgId]` club home: my agents in this club, recent documents, my usage this month | B |
| `/org/[orgId]/catalog` | B |
| `/org/[orgId]/admin`: members, positions, transfer, quotas, installations, club agents | B |
| `/usg/templates` | B |
| `/usg/templates/[templateId]`: versions, distribution, target | B |
| `/usg/clubs`: quotas, club policy | B |
| `/usg/rule-packs` | B |
| `/org/[orgId]/agents/[installationId]`: run + inspector + pending actions | C |
| `/org/[orgId]/documents` | C |
| `/org/[orgId]/preview` | C |
| `/org/[orgId]/audit` | C |
| `/usg/audit` | C |
| `/me/agents` | D |
| `/directory` | D |
| `/directory/[installationId]`: run + inspector | D |
| `/usg/integrations` | D |
| `/demo`: clock control and the reset command | D |

## 15. Seed data (fictional)

**Orgs:** `usg`, `startup` (Startup Club), `archery` (Archery Club), `dance` (Dance Club). Cohort
`pilot` = startup + archery. `roster.csv` adds Robotics Club (§13).

| Persona | Memberships | Used in |
|---|---|---|
| Avery | USG admin | D1, D2, D6, D8 |
| Riley | USG reviewer | review assistant |
| Sam | Startup president | D2, D3, D4, D5, D7 |
| Taylor | Startup treasurer + member | D4, D7 |
| Jordan | Startup member, incoming treasurer | D7 |
| Casey | Startup member | D4, D5 |
| Morgan | Archery treasurer + Startup member | cross-club tests |
| Lee | no club; $0.04 of public-agent usage today | D3, D5 |

| Club | Source | Document | Tier |
|---|---|---|---|
| USG | `rulebook` | USG funding rules (demo text) | public |
| USG | `usg_internal` | Reviewer notes | usg_internal |
| Startup | `public` | Recruiting FAQ | public |
| Startup | `minutes` | Meeting minutes 2026-10-08 | members |
| Startup | `archive` | Past events and venues | members |
| Startup | `finance` | Spring 2026 budget | officers: treasurer (+ president) |
| Startup | `finance` | Sponsor contacts | officers: treasurer (+ president) |
| Archery | `finance` | Archery budget 2026 | officers: treasurer (+ president) |
| Dance | `public` | Spring showcase info | public |

**Rule pack** `usg-funding` v1 (`label: "Demo rule pack"`; `content` keys `annualCapUsd`,
`fundedEventsPerSemester`, `vendorLeadTimeInstructionalWeeks`, `deadline`):
- annual cap $8,000;
- 4 funded events per semester;
- 6 instructional weeks' lead time for approved vendors;
- Wednesday 11:59 PM PT deadline.

D6 publishes v2 with the cap at $10,000. Evaluation of the rules belongs to WP-14.

**Policy and quota:**
- Every club may use `standard` and `economy` and publish public agents. `event-planning` v1 allows
  only `economy`.
- Platform $50/month; each club $5/month; Casey $0.50/month; `student_daily` $0.05; Startup's
  `recruiting-qa` installation and Dance's `showcase-qa` installation $2.50/month.

## 16. Work packages

Each: stream · hours · depends on (stubs suffice until the real hour in `AGENTS.md`) · paths ·
done when. H0 = kickoff. All four people work WP-0 together. P0 = every package except WP-13 and
WP-14.

- **WP-0** · all, led by A · H0–2 · none · repo root, `src/lib/contracts.ts`,
  `src/lib/db/schema/**`, `db/migrations/**` · repo runs; contracts and schema frozen; tables,
  role, RLS, the `read_grants` trigger and `agent_runs_meta` migrated; every stub due by H3 merged.
- **WP-1** · A · H2–5 · WP-0 · `src/lib/db/**`, `db/migrations/**`, `tests/rls.test.ts` ·
  `withActor` and the RLS migration proven: the §10 contract passes as `trojanops_app`.
- **WP-3** · A · H5–7 · WP-1 · `src/lib/{identity,authz}/**`, `src/app/{page.tsx,persona-picker.tsx}`,
  `src/app/api/session/**`, `tests/grants.test.ts` · persona identity, active org, `grantsFor`,
  `capGrants`; Morgan and public-cap tests.
- **WP-4** · A · H7–11 · WP-3, B `effectiveAgent`/`canUse`, C `listAccessibleDocuments` ·
  `src/lib/{gateway,runtime}/**`, `src/app/api/{agents,pending-actions,quota,audit}/**`,
  `db/seed/quota.ts`, `tests/gateway.test.ts`:
  - by H9: steps 1–3 and 5–8 on the mock runtime, plus the audit writer;
  - by H11: quota and billing;
  - denials and blocks never call the runtime.
- **WP-5** · B · H2–7 · WP-0 · `src/lib/distribution/**`, `src/app/api/{directory,me}/**`,
  `db/seed/distribution.ts`, `rules/**`, `tests/distribution.test.ts`:
  - publish, distribute, install, clamps, directory, `myAgents`, publish to all students,
    propagation, retire, `provisionOrg`;
  - `myAgents` tests: Casey, Taylor, Morgan.
- **WP-7** · B · H7–10 · WP-5, A quota stubs · `src/app/org/[orgId]/{page.tsx,catalog/**,admin/**}`,
  `src/app/api/orgs/[orgId]/{catalog,installations,templates,positions}/**`,
  `src/lib/lifecycle/transfer.ts` · club home, catalog with "Publish to all students", members,
  transfer, quotas; D3, D5, D7.
- **WP-6** · B · H10–12 · WP-5 · `src/app/usg/{templates,clubs,rule-packs}/**`,
  `src/app/api/usg/{templates,club-policy,rule-packs}/**` · template list and detail, distribute,
  club quotas and policy, rule-pack publish; D2, D6.
- **WP-8** · C · H2–6 · WP-0 · `src/lib/documents/{library,access}.ts`,
  `src/app/org/[orgId]/documents/**`, `src/app/api/orgs/[orgId]/documents/**`,
  `db/seed/documents.ts`, `db/seed/docs/**`, `tests/documents.test.ts` · upload,
  `listAccessibleDocuments` (real by H5), `explainAccess` with the agreement test.
- **WP-9** · C · H6–11 · WP-8, A runAgent stub · `src/lib/documents/preview.ts`,
  `src/components/inspector/**`, `src/app/org/[orgId]/{agents,preview,audit}/**`,
  `src/app/usg/audit/**`, `src/app/api/orgs/[orgId]/preview/**` · run page with inspector and
  pending actions, preview matrix, audit views; D4, D8.
- **WP-2** · D · H2–5 · WP-0 · `db/seed/{index,orgs,personas}.ts`, `db/seed/roster.csv`,
  `src/app/{layout.tsx,globals.css,fonts.ts}`, `src/components/{ui,shell}/**` · seed runner and
  people; app shell; shadcn components restyled per `ui-designer.md` (no default shadows or pills)
  so the design greps pass.
- **WP-10** · D · H5–9 · WP-2, B `provisionOrg` and A identity stubs · `src/lib/connectors/**`,
  `src/lib/lifecycle/import.ts`, `src/app/usg/integrations/**`, `src/app/api/usg/connectors/**`,
  `tests/connectors.test.ts` · connectors, registry, panel, roster sync with precedence; D1.
- **WP-11** · D · H9–12 · B `directory`/`myAgents`, C `<Inspector />` · `src/app/{directory,me}/**` ·
  campus directory, public-agent runs, my agents; D3, D4.
- **WP-12** · D · H12–20 · all P0 · `src/app/demo/**`, `src/app/api/demo/**` · clock control,
  rehearsed D1–D8, backup video.
- **WP-13** · A · H12–14 (floor), to H16 if time · WP-4 · `src/lib/connectors/llm/**`,
  `src/lib/runtime/real.ts` · floor: `recruiting-qa` answers through one model call with its
  accessible documents in the prompt.
- **WP-14** · C · H12–16 · WP-13 · retrieval, tools and verified citations; `funding-precheck` rule
  evaluation (§17).

**Checkpoints:**
- H2: contracts frozen.
- H3: every stub merged.
- H8: every page renders seed data; `pnpm check` green on `main`.
- H12: platform frozen, D1–D8 pass on the mock runtime.
- H14: WP-13 floor in, or the demo stays on the mock.
- H18: three rehearsals done.

**Three people:** drop stream D as a person.
- A also takes WP-10 (H11–13).
- B also takes WP-11 (H12–14).
- C also takes WP-2 (H0–3, before WP-8) and WP-12.
- From H0, cut club-built agent UI, cohort targeting, USG overview and WP-14. WP-6 shrinks to
  distribute plus rule-pack publish.

**Cut order:** WP-14 → WP-13 beyond its floor → club-built agent UI → cohort targeting → USG overview.

**Never cut:** distribution, publish to all students, the directory and my agents, document
permissions and the preview, quota block, audit, transfer, the integration panel, the WP-13 floor
(unless H14 passes without it).

## 17. Agent implementation (WP-13, WP-14)

- `runtime/real.ts` implements `AgentRuntime` with `LLMProvider` (an adapter for the chosen model in
  `connectors/llm/`). It maps usage (including billed reasoning tokens) into cost, and maps stop
  reasons and refusals.
- Retrieval reads only `accessibleDocuments` from §7 step 5. If chunking is added, chunks copy the
  document's `read_grants` and get the same RLS policy.
- Every claim cites a document it was given. The server checks that each quote is a substring of
  that document and drops unverified claims.
- Tools go through `gateway.tool()`; write tools stay pending until a human confirms.
- Agent-specific data (funding applications, review queue, funding ledger via `ApplicationSink`) and
  rule-pack evaluation are designed in WP-14.

## 18. Demo operations

- Run `pnpm db:reset` (CLI) before each rehearsal and before judging, then restart `pnpm dev`; the
  clock restarts at `DEMO_NOW`.
- The inspector shows run grants as labels ("Startup Club · Treasurer"), sources, permitted and
  cited documents, template and rule-pack versions, the billed club, cost, quota remaining and the
  audit id.
- If a real agent misbehaves on stage, restart with `AGENT_RUNTIME=mock`.
- Record a backup video after the final rehearsal.

## 19. Open questions

- Hackathon: submission deadline, judging criteria, required artifacts.
- Which LLM to plug in (WP-13).
- Who owns each stream; deploy target (local Docker or a hosted URL).
- Trojan AI Gateway API format and student access.
