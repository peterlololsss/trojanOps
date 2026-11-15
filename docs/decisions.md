# Decisions

Newest last. Reopening one needs the whole team; record the outcome as a new entry.

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-11-14 | The product is the platform (integration, distribution, document permissions, governance). Agents are content on it. | The pitch is AI for every club, not one tool. |
| 2 | 2026-11-14 | Platform first on a mock runtime; real agents (WP-13, WP-14) last. No RAG code before then. | The platform demo can't depend on model behaviour or retrieval quality. |
| 3 | 2026-11-14 | The model sits behind `LLMProvider`; the provider is chosen at WP-13. | Lets the team pick a model late and switch to Trojan AI Gateway without code changes. |
| 4 | 2026-11-14 | Permissions use org-qualified grants enforced by Postgres RLS, capped by the agent's max tier. | Role-only checks leaked across clubs; the database, not the prompt, must enforce access. |
| 5 | 2026-11-14 | Audience (who uses an agent) and max tier (what it reads) are separate; a public agent's max tier is always Public. | Clubs can open agents to all students without exposing internal documents. |
| 6 | 2026-11-14 | Three distribution directions: USG → clubs, club → members, club → all students. Students see theirs on `/me/agents` and `/directory`. | Matches how clubs actually serve members and recruits. |
| 7 | 2026-11-14 | Public-agent runs are billed to the publishing club, need an installation limit, and count toward a per-student daily cap. | Outside students must not exhaust a club's quota. |
| 8 | 2026-11-14 | The gateway is a server module, not Next.js middleware. | It needs DB transactions and the runtime's actual usage. |
| 9 | 2026-11-14 | The funding pre-check is a demo agent; its rule pack uses demo values. | The selling point is the platform, not one rulebook. |
| 10 | 2026-11-14 | USC look: Cardinal and Gold, Source Sans 3 and Caslon titles, no USC marks, a "not endorsed by USC" footer. | USC brand and student-organization rules. |
| 11 | 2026-11-14 | Work is split into four streams with path ownership and stubs merged by H3. | Four agents in parallel without editing the same files. |
| 12 | 2026-11-14 | The role, RLS policies, `read_grants` trigger and `agent_runs_meta` view ship in WP-0, not WP-1. WP-1 proves them with the §10 tests. | Every stream can run `pnpm db:reset` and query as `trojanops_app` from H2. |
| 13 | 2026-11-14 | `EffectiveAgent` carries `status` (`enabled`, `disabled`, `retired`). | Gateway step 1 must refuse disabled installations and retired templates without a second lookup. |
| 14 | 2026-11-14 | DB integration tests connect as `trojanops_app` and skip with a notice when the database is unreachable. Sync points run them with Docker up. | `pnpm check` stays usable without Docker; RLS is never tested as the owner. |
| 15 | 2026-11-14 | Agent reads pass their max tier into `withActor`; the documents RLS policy checks it alongside grants and sources. | The same role can grant Officers and USG internal documents. The database must enforce the tier ceiling independently so access agrees with the permission preview. |
| 16 | 2026-11-14 | The document library (`/org/[orgId]/documents`) uses the actor's memberships in the viewed org (`orgId`), recomputed per request with `grantsFor`, not the active org. It never widens beyond positions held in that org. Upload still requires the active org (`app.manage_org`). | A student in several clubs can browse each club's library without switching; upload stays tied to the president's active org, as the `documents_insert` policy checks. |
