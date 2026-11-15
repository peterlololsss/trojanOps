# WP-12 rehearsal and recording runbook

Status: full rehearsal blocked by the P0 dependencies below. This is an executable operator
script, not a receipt for three completed rehearsals. Use fictional demo data only.

## Setup and reset

1. Use an isolated demo database. Configure DATABASE_URL for trojanops_app and the owner URL
   only in the CLI environment. Keep credentials out of recordings and source control.
2. Set DEMO_MODE=1, DEMO_NOW=2026-11-15T10:00:00-08:00 and AGENT_RUNTIME=mock in the launch
   environment. Keep all connectors on the documented mock implementations.
3. Stop the app. Run `pnpm db:reset`, then `pnpm check` with the app-role URL and a reachable
   database. Require zero skipped tests. Restart `pnpm dev`; open `/demo` and check Pacific Time.
4. Use one server process. The clock is process-local; a restart restores DEMO_NOW. A clock jump
   changes time only, so it cannot substitute for a reset. Do not jump dates during D1–D8.
5. Start at `/` as Avery. Keep a terminal ready for restart, hidden from the projected screen.
   Confirm browser zoom, viewport, readable text, audio input and local network before timing.

## Continuous D1–D8 script

Target: five minutes for the product walkthrough, plus the opening and closing below. No reset
between beats. Preserve Lee's daily allowance: the one successful run in D3 consumes the last
$0.01; D5's next public run must be blocked. Extra practice runs require a fresh reset.

| Beat / target | Operator action | Evidence required | Current dependency |
|---|---|---|---|
| D1 / 35s | Avery → `/usg/integrations` → Sync roster; repeat once | Five Mock connectors, absolute sync time; Robotics provisioned with funding-precheck; existing clubs unchanged | D importer/panel real; B provisioning stub cannot establish required installations |
| D2 / 40s | Avery → `/usg/templates`; distribute Event planning to all clubs. Sam → Startup catalog; attempt standard model | Five catalogs include required Funding pre-check and default Event planning; named economy cap rejects standard; installation.rejected audit | B pages/API/seeds incomplete; A durable audit absent |
| D3 / 40s | Sam publishes Recruiting Q&A; read audience and $2.50 installation limit aloud. Lee → `/directory` → Recruiting Q&A → one run | Publication confirmation; directory reflects mutation; Inspector shows Startup public FAQ only | B publication UI/API absent, listings fixture-backed; C Inspector stub/document access fixtures |
| D4 / 45s | Casey → `/me/agents`; Taylor → same; Sam → Startup permission preview | Casey sees handoff + recruiting; Taylor adds funding; Member cannot read budget; Treasurer can; public agent excludes minutes | D listing/session flow real against B fixtures; C preview/internal run routes absent |
| D5 / 40s | Sam sets Casey to $0.00; Casey attempts handoff. Lee attempts recruiting again | Both blocked before runtime; Lee cap $0.05 and reset at midnight PT; prior $0.01 billed to Startup | A quota enforcement/usage seed/durable run accounting incomplete; B limit UI and C run route incomplete |
| D6 / 30s | Avery publishes usg-funding v2 at $10,000; Taylor runs funding-precheck | Next run names Demo rule pack v2 and $10,000 cap | B rule-pack UI/API and C internal run incomplete; evaluation belongs to WP-14 |
| D7 / 35s | Sam transfers Treasurer Taylor → Jordan; compare My agents; Avery syncs roster unchanged | Taylor loses funding, Jordan gains it, installations/docs unchanged; roster does not undo manual transfer | B transfer stub and fixture-backed eligibility; A roster_state DELETE grant needed for removals |
| D8 / 35s | Avery → `/usg/audit`; Sam → club audit | All beats including rejection; metadata only; unreadable titles are Restricted document; no run input/output exposed | A audit in memory; C audit pages absent |

Fixture outputs and arranged component states prove their stated boundaries only. Do not present
Showcase Q&A as proof of Startup publication or a synthetic quota error as enforced billing.
Current implementation details and prior evidence are in d-wp2/10/11-verification.md.

## Rehearsal ledger and release gate

| Run | Reset + revision | D1–D8 result | Duration / recording | Status |
|---|---|---|---|---|
| 1: functional | Pending owner integration | Not run end to end | Not recorded | Blocked |
| 2: timed | Pending successful run 1 and fresh reset | Not run | Not recorded | Blocked |
| 3: dress | Pending successful run 2 and fresh reset | Not run | Not recorded | Blocked |

For each run, record date/time PT, revision or uncommitted slice manifest, runtime, connector modes,
reset/check log, operator, exact failed beat, screenshot or video timecode, owner and resolution.
Rerun after fixes from a fresh reset. All eight beats must pass in the same continuous run.
The workflow's platform-freeze/demo tags require the corresponding demonstrated checkpoints;
this slice does not create them. Submission deadline, judging rubric and artifact format remain
open questions in architecture §19; verify with the organizers before submission.

## Backup video

Record only after the third successful rehearsal, from another fresh reset using the same build.
Capture the app at 1440×900 or 1920×1080, readable browser zoom, clear microphone and no desktop
notifications. Follow the same timed script; say “mock runtime” and keep the placeholder labels
visible. Never splice arranged outcomes into a recording claimed to be an integrated run.

Export a local MP4 (H.264 video/AAC audio where the recorder supports it). Play the entire export
offline on the presentation laptop; check duration, text legibility, speech, all eight beats and
that no credentials appear. Keep an offline copy on a second device. Record filename, duration,
build, runtime, reset log and D1–D8 timecodes in the ledger. A silent screen capture is not a
completed narrated backup. No full-demo backup video currently exists: the required integrated
rehearsals are blocked. A partial diagnostic recording must be labeled as partial.

## Presentation script

Opening (25 seconds): “Every USC club needs continuity, recruiting help and a way to navigate
student-government rules. Today those tools and documents are scattered. TrojanOps gives USG
one place to distribute governed agents and lets each club decide who can use them.”

Transition to D1–D3: “These five integrations are mocks for the hackathon. The platform governs
distribution and access independently of the model. Watch a new club enter, receive a template,
and publish a public recruiting assistant.” Use those claims only after the corresponding beats
work; on this build say provisioning and publication are pending integration.

Transition to D4–D8: “Who may use an agent is separate from what documents it may read. Officers
and members have different access. Every run goes through the gateway, with quota and audit
designed as platform controls.” While owner work remains incomplete, explicitly say enforced
quota and durable audit are pending; do not describe them as delivered.

Closing (20 seconds): “The product is a governed platform for every club. We built around
org-qualified permissions, a common gateway and replaceable connectors. Next is completing the
remaining integration work, then connecting real campus systems and models.”

Questions: distinguish the platform gateway from Trojan AI Gateway; explain audience versus
maximum document tier; acknowledge mock connectors/runtime and every unresolved owner dependency.
The student-built prototype is not endorsed by USC. If the app fails, use the verified offline
backup. If only a partial backup exists, disclose its scope and present the architecture instead.
