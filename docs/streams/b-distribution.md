# Stream B: Distribution

**Owner:** TBD. You own how agents reach clubs and students: templates, versions, installations,
clamps, the directory and my agents, plus the club console and the USG templates console. Your paths
are in `AGENTS.md`.

## Work packages

| WP | Hours | Done when (full text: `docs/architecture.md` §16) |
|---|---|---|
| WP-5 | H2–7 | Publish, distribute, install, clamps, directory, `myAgents`, publish to all students, propagation, retire, `provisionOrg`; `myAgents` tests for Casey, Taylor, Morgan |
| WP-7 | H7–10 | Club home, catalog with "Publish to all students", members, transfer, quotas; D3, D5, D7 |
| WP-6 | H10–12 | Template list and detail, distribute, club quotas and policy, rule-pack publish; D2, D6 |

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
- D6: rule-pack v2.
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
`publishRulePack(actor, slug, {label, content})`. These are services; their HTTP routes and UI
are a later slice. `distribute` returns `{count}` for installations inserted or required agents
re-enabled, so repeating a distribution returns 0. Existing overrides, pins and default-agent
opt-outs are retained. New public installations receive a half-club installation budget.

Version drafts and installation patches are strictly validated. Publication checks every `latest`
installation against the proposed version before advancing `latestVersion`; an incompatible
club override rejects the publication rather than breaking campus lists. Pinned installations keep
their version. Retired templates cannot be published, distributed or edited through these services.
Rule-pack publication takes effect on the next funding-agent read, including pinned templates.

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
The shared `audit('position.transfer')` writer is called after that transaction commits, following
the existing service pattern; it has no transaction parameter. Audit details contain ids and a
changed flag. A failed replacement insert rolls back the old tenure and emits no success audit.

`TODO(verify):` this succession service accepts only single-holder officer positions and current
club members as recipients; it permits filling a vacant office. A shared Member position or an
office with several distinct current holders is rejected instead of removing multiple people.
Confirm these guardrails when building the admin form.

The service never modifies `roster_state`. This preserves the original imported holders, so an
unchanged roster still compares equal and must not override the manual assignment (§13). Stream D
must compare incoming roster positions against `roster_state`, not current memberships, and should
coordinate membership writes with this service's club-row lock. `TODO(verify):` D's
`src/lib/lifecycle/import.ts` does not exist on this branch yet: the transfer tests verify the
preserved baseline against the seed CSV, not a simulated or end-to-end roster sync. Add the full
sync-after-transfer regression when that service lands. The transfer API and admin form remain
separate slices.
