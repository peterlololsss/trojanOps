# Stream B: Distribution

**Owner:** TBD. You own how agents reach clubs and students: templates, versions, installations,
clamps, the directory and my agents, plus the club console and the USG templates console. Your paths
are in `AGENTS.md`.

## Work packages

| WP | Hours | Done when (full text: `docs/architecture.md` §16) |
|---|---|---|
| WP-5 | H2–7 | Publish, distribute, install, clamps, directory, `myAgents`, publish to all students, propagation, retire, `provisionOrg`; `myAgents` tests for Casey, Taylor, Morgan |
| WP-7 | H7–10 | Club home, catalog with "Publish to all students", members, transfer, quotas; D3, D5, D7 |
| WP-6 | H10–12 | Template list and detail, distribute, club quotas and policy; D2 |

## You provide

Stubs by H3.

| Interface | Real by |
|---|---|
| `effectiveAgent()`, `canUse(userId, agent)` | H6 |
| `directory()`, `myAgents()`, `provisionOrg()`, `publishToAllStudents()` | H7 |
| `transferPosition()` | H9 |

## You consume

- A: `getActor`, `grantsFor` (real H7) and `quota.*` (real H11).
- A: `audit()` (real H9).
- C: `listLibraryDocuments()` (real H6), for the club home's recent documents.

## Demo beats

- D2: distribute plus the rejected widening.
- D3: publish to all students.
- D6: USG Funding Department Guidelines v2 (document version, `/usg/documents`).
- D7: transfer.
- D5: the quota UI.

## Watch for

- `canUse` reads positions in the agent's club, not in the actor's active org.
- `myAgents` iterates distinct clubs.
- `provisionOrg` installs only distributed templates.
- A clamp violation returns `clamp_violation` and writes `installation.rejected`.
- A public installation needs an installation limit.

## First prompt

> Read `AGENTS.md`, `docs/architecture.md` §6, §8 and §16, and `docs/streams/b-distribution.md`.
> Plan WP-5 test-first: clamps, `distribute`, `myAgents` (Casey, Taylor, Morgan), `provisionOrg`,
> publish to all students. Edit only stream B paths. Show me the plan first.

## WP-5 write services

`distribution` exports `distribute(actor, templateId)`, `publishVersion(actor, templateId, draft)`,
`retire(actor, templateId)`, `updateInstallation(actor, installationId, patch)`, and
`publishRulePack(actor, slug, {label, content})`. Their HTTP routes are listed below; the UI is a
later slice. `distribute` returns `{count}` for installations inserted or required agents
re-enabled, so repeating a distribution returns 0. Existing overrides, pins and default-agent
opt-outs are retained. New public installations receive a half-club installation budget.

Version drafts and installation patches are strictly validated. Publication checks every `latest`
installation against the proposed version before advancing `latestVersion`; an incompatible
club override rejects the publication rather than breaking campus lists. Pinned installations keep
their version. Retired templates cannot be published, distributed or edited through these services.
Rule-pack publication takes effect on the next funding-agent read, including pinned templates.

Only `publishToAllStudents` may open an agent to the whole campus. A patch that would reach the
same state — setting the audience to public, or merely enabling an installation whose version is
public — is refused with `clamp_violation` on `audience`, because the publish path is what checks
the club has a budget, gives the installation one and audits `agent.publish_public` (§8, §12).

## WP-5 HTTP routes (§14)

| Method and path | Service | Who |
|---|---|---|
| GET `/api/directory` | `directory()` | any signed-in student |
| GET `/api/me/agents` | `myAgents()` | the caller, for the caller only |
| POST `/api/orgs/:orgId/installations/:id/publish` | `publishToAllStudents` | club president |
| PATCH `/api/orgs/:orgId/installations/:id` | `updateInstallation` | club president |
| POST `/api/templates/:id/versions` | `publishVersion` | USG admin (global), president (own) |
| POST `/api/usg/templates/:id/distribute` | `distribute` | USG admin |
| POST `/api/usg/templates/:id/retire` | `retire` | USG admin |
| POST `/api/usg/rule-packs/:slug/versions` | `publishRulePack` (not used by the UI, decision 19) | USG admin |
| POST `/api/orgs/:orgId/positions/:slug/transfer` | `transferPosition` | club president |

Each handler is `getActor` → one service call → JSON or `ApiError`; permissions stay in the
services, which resolve the club from the row. A path's `orgId` is passed through and refused like
an unknown id when it does not match, so a URL naming one club cannot act on another's agent.
Every write parses its body with `parseBody` even when the body is empty: the `application/json`
check is the cross-site write guard, and an empty-bodied cross-origin POST sends no content type.

| GET `/api/orgs/:orgId/catalog` | `catalog()` | the club's members, and USG admins |

Still unrouted, because the services do not exist yet: the installations collection,
`createClubTemplate` and `setClubPolicy`.

`catalog()` is scoped to the club's members (§14): it carries the club's monthly quota, each
agent's budget, and for USG the configuration of an internal agent. `clubProfile()` is the
unscoped lookup a page uses to name a club before deciding what the viewer may see.

Writes lock template → clubs in id order → installation. Non-key locks permit foreign-key reads
from the separate quota transaction. Public publishing uses the same writer as installation edits.
Quota bootstrap inserts share A's advisory lock to prevent duplicate limit rows.
Interactive limits use A's DB-backed `quota.setLimit` outside the installation transaction; the
writer then re-locks and re-clamps the fresh row before applying it. If that second check rejects,
an unused quota update can remain, but an invalid installation cannot be written. Run `tests/distribution-writes.test.ts` against port 5433 for
D2, D6, propagation, rejection rollback, permissions and the separate-connection quota FK check.

## WP-7 succession service (D7)

`transferPosition(actor, orgId, positionSlug, toUserId)` is implemented at
`src/lib/lifecycle/transfer.ts`. It locks the club, refreshes the president's authority, ends the
previous office and inserts a `source: 'manual'` membership in one transaction. Other memberships,
installations and documents are unchanged. Repeating the current assignment preserves the row.
The shared `audit('position.transfer')` writer is called after that transaction commits; it could
take the transaction (`audit(action, event, tx)`) to commit with it. Audit details contain ids and a
changed flag. A failed replacement insert rolls back the old tenure and emits no success audit.

`TODO(verify):` this succession service accepts only single-holder officer positions and current
club members as recipients; it permits filling a vacant office. A shared Member position or an
office with several distinct current holders is rejected instead of removing multiple people.
Confirm these guardrails when building the admin form.

The service never modifies `roster_state`. This preserves the original imported holders, so an
unchanged roster still compares equal and must not override the manual assignment (§13). Stream D
must compare incoming roster positions against `roster_state`, not current memberships, and should
coordinate membership writes with this service's club-row lock. D's
`src/lib/lifecycle/import.ts` compares against `roster_state`; `tests/roster-import.test.ts` covers a
sync after a manual transfer. The transfer API and admin form remain
separate slices.

## WP-6 USG console

`/usg/templates`, `/usg/templates/[templateId]` and `/usg/clubs` now
use authorized, serializable server models in `usg-view.ts`. USG admins can review version history,
change rollout metadata, distribute to all active clubs or a seeded cohort, publish immutable
versions, retire templates and edit club quotas/policy. Required
rollouts and retirement require the typed template name; other publication actions show a review.
Client components import only distribution types and call the existing HTTP services.

New §14 routes:

- GET/PATCH `/api/usg/templates/:templateId`: immutable history/target summary and strict metadata
  edits (`name`, `target`, `distribution`). Changing a target affects future rollout/provisioning;
  it does not remove old installations. A distributed template keeps its distribution type.
- PUT `/api/usg/club-policy/:orgId`: USG-only policy update. Checks every non-retired installed resolved version
  against the proposed policy before writing, including disabled/pinned installations. A conflicting
  override or public agent must be narrowed by its club first; the policy setter does not disable
  or rewrite that club's installation silently.
- POST `/api/orgs/:orgId/installations`: president-only optional global/own-club installation,
  body `{templateId}`. Cohorts, active club/template, policy and I7 are checked before inserting.
  Existing installations are preserved. New public installations stay disabled and receive an own
  budget; opening them to the campus still requires Publish to all students.

`TODO(verify):` frozen `AuditAction` has no policy or metadata edit action. Policy edits currently use
`installation.update` with an org target and `resource: 'club_policy'` (visible in the president's
audit); metadata edits use `template.publish` with `metadataOnly: true`. Ask A to add dedicated
contract actions before relying on these labels for reporting. No contract was changed here.

Validation: `tests/usg-management.test.ts` covers console authorization, denied-read audits,
policy clamps/audit visibility, immutable version history, optional installation, and these routes.
D2/D6 were also exercised through the local pages: distribute Event planning to three clubs, reject
Sam's standard-model override with the economy cap, publish the $10,000 funding pack, and run the
funding agent through the gateway to see v2. Use `pnpm db:reset` before the full test run after such
browser checks, since those demo actions deliberately change the seeded database.


### Retired installations and policy tightening

Terminal retired templates do not block a later policy change. Disabled and pinned installations
of active templates still pass the full I7 policy check before any write. Historical versions,
installation overrides, quotas and audit history are not rewritten or deleted to satisfy a new
policy. Catalog reads retired presentation metadata separately, marks it unavailable, and never
uses that projection as an `EffectiveAgent`; a fresh retired record wins over an earlier active
snapshot when retirement races the read. Runtime composition and policy clamps remain unchanged.
A now policy-incompatible retired installation fails closed with the generic runtime clamp refusal
before execution, rather than reaching A's specific retired-status denial message. Preserving that
specific gateway message/audit for this case remains an A integration consideration.

`tests/retired-policy.test.ts` covers public and disjoint-model policy changes after retirement,
unchanged historical/pinned records, catalog visibility and concurrent retirement, exclusion from
usable lists, and gateway rejection before runtime/quota use. It also checks that disabled/pinned
installations of active templates still prevent incompatible changes.
