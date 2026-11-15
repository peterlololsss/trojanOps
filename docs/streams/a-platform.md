# Stream A: Platform core

## Chat and credits delivery, 2026-11-15

Delivered class-priced holds and mock settlement (Economy 1 credit, Standard 3), optional validated
run model selection, real binding quota/reset context, current-user usage and manager-only cited
counts. Prices live in `gateway/prices.ts`; services remain micro-USD and preserve I1-I15. No frozen
contract, schema or migration changes. Funding submission is a pending human decision, not execution.

**Owner:** TBD. You hold the contracts, the database and the gateway that every run passes through.
Your paths are in `AGENTS.md`.

## Work packages

| WP | Hours | Done when (full text: `docs/architecture.md` §16) |
|---|---|---|
| WP-0 (lead) | H0–2 | Repo runs; contracts and every schema file frozen with the area owners; tables, role, RLS and trigger migrated; every stub merged |
| WP-1 | H2–5 | `withActor` and the WP-0 RLS migration proven: the §10 visibility contract passes as `trojanops_app` |
| WP-3 | H5–7 | Persona identity and the demo sign-in at `/`, active org, `grantsFor`, `capGrants`; Morgan and public-cap tests |
| WP-4 | H7–11 | `runAgent` §7 steps 1–3 and 5–8 on the mock runtime with the audit writer by H9; quota and billing by H11 |
| WP-13 | H12–14, to H16 if time | Floor: `recruiting-qa` answers through one model call with its accessible documents |

## You provide

Stubs by H3, at their real paths.

| Interface | Real by |
|---|---|
| `contracts.ts`, schema, migrations | H2 |
| `withActor`, `clock.now()` | H5 |
| `getActor`, `grantsFor`, `capGrants` | H7 |
| `audit()`, `gateway.runAgent()` | H9 |
| `quota.setLimit`, `quota.remaining` | H11 |

## You consume

- B `effectiveAgent`, `canUse`: real at H6.
- C `listAccessibleDocuments`: real at H5.

## Demo beats

- D5 (quota block): with B's admin page.
- D8: the audit writer behind every beat.
- The mock runtime behind every run.

## Watch for

- RLS is silently bypassed by the owner role, by `SET` without `LOCAL`, and by `RETURNING` on RLS
  tables (§5).
- `pnpm db:reset` must work twice in a row.
- The mock costs $0.01 for Economy or $0.03 for Standard; a limit of 0 always blocks.
- You are the only one who generates migrations.

## First prompt

> Read `AGENTS.md`, `docs/architecture.md` §2, §5–§7 and §16, and `docs/streams/a-platform.md`.
> Plan WP-1: `tests/rls.test.ts` for the §10 contract, run as `trojanops_app` through `withActor`
> against the tables, RLS and `read_grants` trigger already in `db/migrations/`. Fix what the tests
> find. Edit only stream A paths. Show me the plan first.
