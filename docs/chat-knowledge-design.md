# Chat, credits and knowledge pages for the TrojanOps demo

## 1. Plan in brief

- **Pages first, on mock and fixture data.** The chat page, the credits and usage pages and five
  knowledge pages are built for the demo on the mock runtime and a labelled demo index. Every
  access and quota decision on them is real: RLS, `explainAccess`, the gateway's holds and blocks.
  Answer text, chunk boundaries, index status, retrieval scores, model prices and the pacing of the
  answer reveal are demo.
- **The chat page works like a campus AI platform** (XJTLU's XIPU AI, Poe, HKU GenAI):
  - a model picker in the composer row;
  - a price before you send ("≈ 3 credits") and the deduction after ("−3 credits · 47 left");
  - a balance with its reset date;
  - low-balance and blocked states that say who can raise the limit;
  - starters, Markdown, inline citations with an access reason, and a progressive reveal that
    narrates the finished run's real steps.
- **Credits (积分) for students, dollars for budget holders.** 1 credit = $0.01 of the billed
  club's AI budget. Quota stays in micro-dollars in the database. Presidents and USG see dollars
  with credits beside them, because USG allocates dollars.
- **Which models members may pick is already in the data.** A template version lists its model
  classes and USG lists the classes each club may use. An installation with no model class lets
  members choose among both lists; a club that sets one fixes it. Runs never leave what the
  template and USG allow (I7).
- **Knowledge pages, Dify-style, without its workflow canvas:**
  - Documents becomes the knowledge base: who can read each document, index status, chunks,
    agents and real citation counts.
  - A document page shows chunks with their inherited tier.
  - A Retrieval test runs as a position and lists the chunks that permissions kept out.
  - Upload ends with an access receipt.
- **Contract:** one additive field tomorrow, `modelClass` in the runs request body.
  `contracts.ts`, the schema and the migrations stay unchanged. Multi-turn memory waits for a later
  change (section 11).
- **Capacity:** stream C owns most of the pages. Everything above the cut line lands only if A
  builds two of C's knowledge pages, with C reviewing, which is realistic if the demo stays on the
  mock runtime (section 10).

## 2. What exists today

| Fact | Where |
|---|---|
| The run page renders `<RunWorkspace>` when the viewer may run the agent | `src/app/org/[orgId]/agents/[installationId]/page.tsx:59-61` |
| Composer: a plain textarea labelled "Message"; Ctrl/Cmd+Enter runs; the button reads "Run {agent}" | `src/components/inspector/run-workspace.tsx:114-141` |
| One progress label, "Checking access", for the whole request | `run-workspace.tsx:143-150` |
| Hint: "Press Ctrl+Enter to run. Leaving this page clears the conversation." | `run-workspace.tsx:151` |
| Errors are a banner above the composer, not part of the transcript | `run-workspace.tsx:37-48, 113` |
| The transcript lives in memory; the inspector shows only the latest run | `src/components/inspector/run-state.ts:3-4, 97-104` |
| Replies render as plain text; sources sit behind the "Demo runtime" toggle; the empty state has no starters | `src/components/inspector/transcript.tsx:43-74, 83-89` |
| The directory run page does not use `<RunWorkspace>`: it is a one-shot form | `src/app/directory/[installationId]/page.tsx:35-37`; `public-run.tsx:50-67` |
| Model classes are `standard` and `economy`; an agent carries one resolved class | `src/lib/contracts.ts:7, 30` |
| Allowed classes = the version's list ∩ USG's list for the club; the installation's class, or the version default, is the one used | `src/lib/distribution/clamps.ts:131-144` |
| A null installation column means "use the version's value"; the seed sets no installation overrides | `src/lib/db/schema/distribution.ts:51`; `db/seed/distribution.ts:238-239` |
| Seed defaults: Recruiting Q&A, Showcase Q&A and Event planning Economy; the rest Standard. Event planning allows Economy only | `db/seed/distribution.ts:133, 152-153, 171, 189, 207, 225` |
| The mock costs a flat $0.01 and the hold is the same flat amount; a runtime-reported cost wins | `src/lib/runtime/mock.ts:5, 24`; `src/lib/gateway/quota.ts:282`; `src/lib/gateway/index.ts:96` |
| The runs route takes only `input` | `src/app/api/agents/[installationId]/runs/route.ts:8` |
| Quota block copy is in dollars | `src/lib/gateway/quota-messages.ts:20-29` |
| `remaining()` reads one level; `headroom()` returns only the smallest number | `src/lib/gateway/quota.ts:119-127, 362-381` |
| The club home shows the member's own spend this month | `src/app/org/[orgId]/club-home-data.ts:51-56` |
| No page lists a student's runs across clubs; the "My agents" scope has one item | `src/components/shell/navigation.ts:18` |
| No UI sets an installation's model class (the service accepts it); Administration and USG clubs pages are unbuilt | `src/lib/distribution/install.ts:15`; `src/components/shell/navigation.ts:31-43` |
| No template has a tool, so a pending action never appears on stage | `db/seed/distribution.ts:18-20, 131`; `src/lib/gateway/tools.ts:8, 19` |
| Client code can't read the clock: `new Date()` and `Date.now(` are grep-banned (I9) | `scripts/check.ts:85-93` |
| Documents table: Title, Source, Tier, Version, Uploaded; rows open nothing; `LibraryDocument` has no access fields | `src/app/org/[orgId]/documents/document-library.tsx:18-40`; `src/lib/contracts.ts:45-53` |
| Documents store `allowed_positions` and `read_grants`; `explainAccess` is pure; the preview's subjects are fixed | `src/lib/db/schema/documents.ts:30-31`; `src/lib/documents/access.ts:35-53`; `src/lib/documents/preview.ts:25-33` |
| `agent_runs_meta` keeps `cited_document_ids` and `model`, never input or output | `src/lib/db/schema/runs.ts:32-48` |
| Club and USG audit views shipped (D8) | commit `f1e9a38` |

## 3. What is real and what is demo

| Real on every page | Demo, and labelled |
|---|---|
| Identity, run grants, audience, quota holds, blocks and settles | Answer text from the mock runtime, labelled "Demo runtime: placeholder answer" (`.claude/agents/ui-designer.md:100-101`) |
| The model a run used and what it cost (the gateway validates and bills the picked class) | Prices per model class (Economy 1 credit, Standard 3), constants until WP-13 prices models |
| Which documents a run or a position can read | How fast the answer reveals (every step it narrates comes from the finished run) |
| Pending actions, Confirm and Reject, audit rows | Chunk boundaries, index status, retrieval scores: the "Demo index" and "Demo scores" chips |
| Document citation counts and usage history (`agent_runs`, `agent_runs_meta`) | Starters, from a fixture keyed by template slug |

Two rules keep the demo honest on stage:
- **No fake usage numbers.** Credits, history and counts come from runs, or aren't shown.
- **The demo index never reaches a run.** Runs still answer from the mock runtime, so
  `AGENTS.md:35` holds.

## 4. Models and credits

### 4.1 Credits for students, dollars for budget holders

| Who | Shows | Example |
|---|---|---|
| Students: chat composer, transcript, My usage | Credits; the dollar value in a tooltip | "47 credits left · resets Dec 1"; tooltip "1 credit = $0.01 of Startup Club's AI budget" |
| Everyone: the run inspector's Billing section | Both | "3 credits ($0.03)" |
| Presidents and USG: Administration, USG clubs, audit | Dollars first, credits beside them; limits typed in dollars | "$0.50 · 50 credits" |

Why:
- Campus platforms call them 积分, and students read "−3 credits" faster than "−$0.03". A price in whole
  credits makes the per-model weighting visible; XIPU once expressed it as separate monthly
  question caps per model.
- USG allocates dollars, the ledger is micro-USD (§11) and the money format is "$0.42"
  (`.claude/agents/ui-designer.md:160-161`). The fixed rate keeps both exactly convertible, with
  no second ledger.

### 4.2 Prices

| Model class | Price per message | Hold before the run |
|---|---|---|
| Economy | 1 credit ($0.01) | 1 credit |
| Standard | 3 credits ($0.03) | 3 credits |

- These are demo constants in A's mock runtime, re-exported to pages by
  `src/lib/gateway/prices.ts`; only the gateway may import the runtime (I5).
- On the mock the price is exact. After WP-13 the hold is the class's ceiling and the charge is
  what the run used (§17). The label then reads "up to 3 credits", and the deduction shows one
  decimal.
- D5 still holds: Recruiting Q&A defaults to Economy, so Lee's run costs $0.01.

### 4.3 Who pays

- Every run is paid from the club that owns the agent (`billed_org_id = agent.orgId`,
  `src/lib/contracts.ts:19`). Students don't pay. Their allowances cap how much of a club's
  budget they can use: a member's monthly allowance in each club, and every student's daily
  allowance for public agents.
- The balance shown is the level that would block first: the smallest remaining among the levels
  that apply, the same number the inspector shows (`src/lib/gateway/quota.ts:357-381`). It is
  labelled by scope:

| Binding level | Balance chip | Tooltip adds |
|---|---|---|
| member | "47 credits left · resets Dec 1" | "Your allowance in Startup Club: 47 of 50 this month. Paid by Startup Club." |
| student_daily | "1 credit left today · resets at midnight PT" | "Your allowance for public agents: 1 of 5 today. Paid by each agent's club." |
| org | "483 credits left · resets Dec 1" | "Startup Club's AI budget: 483 of 500 this month." |
| installation | "250 credits left · resets Dec 1" | "Recruiting Q&A's budget in Startup Club: 250 of 250 this month." |
| platform | "credits left on TrojanOps" | "TrojanOps platform limit." |

### 4.4 Which models the picker offers

- **Allowed** is the template version's classes ∩ USG's classes for the club (`clamps.ts:132`).
- **A null installation model class means members choose** within the allowed list, starting on
  the version's default. A class the club sets is fixed, and the picker shows it as the only
  option with "Startup Club set Club handoff to Economy."
- The seed sets no installation model class, so every agent opens with a choice except Event
  planning, whose template allows Economy only.
- **The gateway re-checks every run.** A class outside the list returns `clamp_violation` 422
  ("Event planning may run on Economy only.") and writes `authz.denied` with reason `model_class`.
- **Nothing widens (I7).** A run uses only classes the template and USG allow, and the club can
  still fix one. If clubs later need "Economy and Standard but not a third class", installations
  need a list column (B, schema).

### 4.5 Where the picker sits: the composer row

The picker goes in the composer row, left of the price and Run, not in a per-chat settings panel
like XIPU's "Config" (Name, Model, Icon, Context Count):
- The model changes the price of the next message. Model, price and Run in one row show the cost
  at the moment of choice, the way Poe's cost label does. ChatGPT and Open WebUI also put the model
  in the composer.
- Our conversations aren't saved rooms, so a room settings panel would have nothing to belong to.
  It would also cost an extra click on stage.
- Each message is held, billed and recorded at its own class, so a per-message control matches the
  ledger. The choice stays for the conversation, and "New conversation" resets it to the club
  default.
- XIPU's "Context Count" belongs with multi-turn history. When that lands (section 11), it goes in
  the model menu's footer.

### 4.6 Before, during and after a message

| Moment | What shows |
|---|---|
| Before | Model chip "Standard ▾", the label "≈ 3 credits", the balance chip "47 credits left · resets Dec 1" |
| Low | At 80% used or more, the attention chip "80% used" sits beside the balance. When the picked model costs more than is left: "Standard needs about 3 credits and you have 1 left today." with [ Switch to Economy ], "or wait until midnight PT" |
| Blocked on load | Nothing affordable is left, so a banner above the composer gives the block message (below) as soon as the page opens. Run stays enabled; pressing it returns the same message from the gateway |
| During | The balance doesn't move until the run finishes; the hold is in place |
| After | The answer's meta row reads "Standard · −3 credits". The balance chip shows "−3" for two seconds and then "44 credits left". The live region says "3 credits used. 44 left this month." |
| Blocked | The transcript note "Blocked before the agent ran", the message, "Nothing was charged." |

Block messages, replacing the dollar copy in `src/lib/gateway/quota-messages.ts:20-29` and the §11
table (`docs/architecture.md:664-672`):

| Scope | Message |
|---|---|
| member | "You've used this month's 50 credits in Startup Club. They reset Dec 1. Ask Sam, your club president, to raise your allowance." When the allowance is 0: "Your allowance in Startup Club is 0 credits this month. Ask Sam, your club president, to raise it." |
| student_daily | "You've used today's 5 credits for public agents. They reset at midnight PT." |
| installation | "Recruiting Q&A has used its 250 credits for this month in Startup Club. They reset Dec 1. Ask Sam, Startup Club's president, to raise its budget." |
| org | "Startup Club has used its 500 credits for this month. They reset Dec 1. USG can raise the club's budget." |
| platform | "TrojanOps has reached this month's platform limit. It resets Dec 1." |

The reset date comes from `clock.now()` through a new `periodEnd()` beside `periodStart()` in
`src/lib/gateway/period.ts`. The president's name is a `TODO(verify):` (see section 13).

### 4.7 What changes, and who changes it

| Change | Owner | Contract or schema |
|---|---|---|
| The mock reports cost and `usage.model` (`demo-economy`, `demo-standard`) by the run's class | A (`src/lib/runtime/mock.ts`) | none: `usage.costMicro` is runtime-reported (`src/lib/contracts.ts:66`) |
| The hold uses the class price | A (`src/lib/gateway/quota.ts:282`) | none |
| The runs body accepts `modelClass?`; `runAgent` takes it as an option, validates it and runs `{ ...agent, modelClass }` | A (`src/app/api/agents/**`, `src/lib/gateway/index.ts`) | additive field on a §14 route: a `contract` PR, `contracts.ts` unchanged |
| `LoadedAgent.allowedModelClasses`: [the set class], or version ∩ policy when it's null | B (`src/lib/distribution/compose.ts`, `queries.ts`) | none (B's own type, like `updateAvailable`) |
| Credits copy with reset dates; `periodEnd()` | A (`src/lib/gateway/quota-messages.ts`, `period.ts`) | none; update the §11 table |
| `quotaLine()`: the binding level with its scope and `resetsAt`; `myUsage()` | A (`src/lib/gateway/quota.ts`, `usage.ts`) | none |
| "Null model class means members choose" | B and A | record as a decision; update the §5 note and the §8 clamps row |
| The §7 mock line becomes "Economy $0.01, Standard $0.03 per run" | A | doc; A's gateway tests that assume a flat $0.01 hold change with it |

## 5. Chat page

### 5.1 Feature decisions

Owner is by path. Hours are in section 10.

| Feature | Decision | Owner | Notes |
|---|---|---|---|
| Model picker in the composer row, price label, balance chip, low and blocked states | P0 | C, A plumbing, B allowed list | Section 4 |
| Docked composer; Enter runs, Shift+Enter new line, Ctrl/Cmd+Enter kept, IME guard | P0 | C | Ignore Enter while `isComposing` (Chinese and Japanese input) |
| Three starters per agent that fill the composer | P0 | C | Fill, don't send: every run is billed, and Lee has one credit left (D5) |
| Scope line before the first run; inspector filled at load | P0 | C | From `effectiveAgent`, `capGrants`, `grantLabels`; no titles, so nothing leaks |
| Privacy line | P0 | C | Replaces "Leaving this page clears the conversation" |
| Inline notes: blocks, failures, changes of access or rule pack between runs | P0 | C | Blocks stay in the transcript |
| Copy; Try again on network and server errors; New conversation; finished-run trace | P0 | C | No retry for quota, access or sign-in errors |
| Progressive reveal ("playback") with Stop | P0 | C | Narrates the finished run's real steps; Stop says the run already finished |
| Markdown | P0 | D (`ui/markdown`) | React elements only, never raw HTML |
| Inline `[n]` citations, sources row, quote popover with access reason, "Uses Officers information" label | P0 | C | Inline markers come from mock reply v2 (A) |
| A pending write action on stage | P0 | A, B | The mock proposes `submit_to_queue`; B adds the tool to `funding-precheck` v1 |
| Directory run page on `<RunWorkspace>` | P0 | D | Lee's D3 and D5 get all of the above |
| Selecting an older run's inspector; Edit message on a blocked run | P1 | C | Until then "Show in inspector" appears on the latest answer only |
| Quick look Sheet from a citation, quote highlighted | P1 | C | Until then "Open in document" opens the document page |
| Transcript kept across in-app navigation; History popover for this tab | P1 | D provider, C | Memory only, keyed by persona |
| Scripted demo answers for the starters | P1 | A | Used only when the run can read every document they cite |
| Run again; feedback | P2 | C, A | The mock repeats itself; feedback needs an audit action to be real |
| Attachments | Not planned | — | Uploads into chat would bypass document tiers |
| Memory across runs | Later | A | Section 11; the inspector's History row says what the demo runtime does |

### 5.2 Layout

- Two columns per the run-page rule (`.claude/agents/ui-designer.md:83-98`): transcript (max 720px)
  and inspector (384px, sticky). The transcript reads like a document: turn labels, 1px rules, no
  bubbles and no avatars.
- The page scrolls, and the composer is `sticky bottom-0` inside the transcript column, so the
  footer disclaimer stays on the page.
- The composer box holds the textarea and one toolbar row:
  - model chip (a `DropdownMenu` with radio items);
  - price label;
  - balance chip, with the "80% used" chip beside it when it applies;
  - Run, or Stop during playback.
- Page header: agent name (Caslon), "{club} · {purpose}", and "New conversation" as the action.
  Under it a strip: audience chip, template version, "Paid by Startup Club".
- An answer turn has:
  - a label row: agent name, the "Demo runtime: placeholder answer" chip, and the tier label on
    the right;
  - the body;
  - the sources row;
  - the meta row: "Standard · −3 credits · Read 3 of 3 permitted documents · Audit #431";
  - Copy and Details.
- Symbols in the wireframes stand for lucide icons: `✓` check, `◷` clock, `[!]` alert-circle,
  `[lock]` lock, `⊖` circle-minus, `↑` arrow-up-circle, `■` square, `ⓘ` info.

### 5.3 Wireframes

**C1 · Empty, with starters** (Casey, Club handoff)

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ TrojanOps   My agents   Directory   Club: Startup Club                               Persona: Casey ▾ │
├─────────────┬────────────────────────────────────────────────────────────────────────────────────────┤
│ Overview    │ Club handoff                                                     [ New conversation ]  │
│ Catalog     │ Startup Club · Helps incoming officers catch up on decisions, events and budgets.      │
│ Documents   │ [All members]  Template v1 · Paid by Startup Club                                      │
│             │ ┌ Transcript, max 720 ───────────────────────────────────┐ ┌ Run inspector, 384 ────┐ │
│             │ │ What Club handoff can read for you                     │ │ Before your first run  │ │
│             │ │ It reads Startup Club's Public, Minutes, Archive and   │ │ Run grants             │ │
│             │ │ Finance sources. It runs as you (Startup Club ·        │ │  Any signed-in student │ │
│             │ │ Member), so it can use Public and Members documents.   │ │  Startup Club · Member │ │
│             │ │ Officer documents need an officer position.            │ │ Sources                │ │
│             │ │                                                        │ │  Startup Club · Public │ │
│             │ │ Try asking                                             │ │  Startup Club · Minutes│ │
│             │ │ ┌────────────────────────────────────────────────────┐ │ │  Startup Club · Archive│ │
│             │ │ │ What did we decide at the Oct 8 meeting?           │ │ │  Startup Club · Finance│ │
│             │ │ └────────────────────────────────────────────────────┘ │ │ Documents              │ │
│             │ │ ┌────────────────────────────────────────────────────┐ │ │  Listed after your     │ │
│             │ │ │ How did pitch night go last year?                  │ │ │  first run.            │ │
│             │ │ └────────────────────────────────────────────────────┘ │ │ Versions               │ │
│             │ │ ┌────────────────────────────────────────────────────┐ │ │  Template v1           │ │
│             │ │ │ What should a new treasurer know first?            │ │ │ Billing                │ │
│             │ │ └────────────────────────────────────────────────────┘ │ │  Paid by  Startup Club │ │
│             │ │                                                        │ │  Model    Standard     │ │
│             │ │ Message                                                │ │  Price    3 credits a  │ │
│             │ │ ┌────────────────────────────────────────────────────┐ │ │           message     │ │
│             │ │ │ Ask Club handoff                                   │ │ │  Your allowance 50 of  │ │
│             │ │ │                                                    │ │ │  50 credits this month │ │
│             │ │ │ [Standard ▾] ≈ 3 credits  50 left · Dec 1 [ ↑ Run ]│ │ │ History                │ │
│             │ │ └────────────────────────────────────────────────────┘ │ │  Earlier messages: not │ │
│             │ │ Enter to run · Shift+Enter for a new line              │ │  sent (demo runtime)   │ │
│             │ │ Only you can see what you ask and what the agent       │ │ Audit                  │ │
│             │ │ answers; your runs are listed in Usage. Startup Club's │ │  Each run writes one   │ │
│             │ │ president and USG see that you ran it, when, the model,│ │  audit event.          │ │
│             │ │ what it cost and which documents it read.              │ └────────────────────────┘ │
│             │ └────────────────────────────────────────────────────────┘                            │
├─────────────┴────────────────────────────────────────────────────────────────────────────────────────┤
│ Student project for the AI@USC Hackathon. Not an official USC service and not endorsed by USC.        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

The scope line by persona:
- Lee, Recruiting Q&A on the directory: "This public agent reads only Startup Club's Public
  source, whoever runs it."
- Taylor, Funding pre-check: "It reads Startup Club's Finance source and the USG rulebook, up to
  Officers. It runs as you (Startup Club · Treasurer)."

**C2 · Model menu and low balance** (Lee, Recruiting Q&A, one credit left today)

```text
┌ Transcript ─────────────────────────────────────────────────────────────────────────┐
│ ... starters ...                                                                     │
│ Message                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Do I need experience to join Startup Club?                                        │ │
│ │                                                                                   │ │
│ │ [Standard ▾]  ≈ 3 credits          1 credit left today [80% used]     [ ↑ Run ]   │ │
│ │ ┌ Model ───────────────────────────────────────┐                                  │ │
│ │ │ ○ Economy                    1 credit a message│                                  │ │
│ │ │   Shorter answers, lower cost                 │                                  │ │
│ │ │ ● Standard                  3 credits a message│                                  │ │
│ │ │   Longer, more careful answers                │                                  │ │
│ │ │ ───────────────────────────────────────────── │                                  │ │
│ │ │ Allowed for Recruiting Q&A by its template,   │                                  │ │
│ │ │ USG and Startup Club. Club default: Economy.  │                                  │ │
│ │ │ Demo runtime: both give the same placeholder  │                                  │ │
│ │ │ answer; only the price differs.               │                                  │ │
│ │ └───────────────────────────────────────────────┘                                  │ │
│ └──────────────────────────────────────────────────────────────────────────────────┘ │
│ [!] Standard needs about 3 credits and you have 1 left today.                        │
│     [ Switch to Economy ]  or wait until midnight PT.                                │
│ Enter to run · Shift+Enter for a new line                                            │
└──────────────────────────────────────────────────────────────────────────────────────┘

The balance chip's tooltip: "Your allowance for public agents: 1 of 5 credits today. 1 credit = $0.01,
paid from Startup Club's AI budget. Resets at midnight PT."
After Switch to Economy and Run, the answer's meta row reads "Economy · −1 credit" and the chip
"0 credits left today · resets at midnight PT [100% used]".
Event planning's menu lists only Economy, with "Its USG template allows Economy only."
A club-fixed agent lists one option, with "Startup Club set Club handoff to Economy."
```

**C3 · Playback** (Taylor, Funding pre-check, first run). Until the response arrives (about 0.2s)
the turn shows only "◷ Checking access and quota". Then the client narrates steps taken from the
returned `RunResult`, about 300ms apart, and reveals the text at about 40 words a second.
`prefers-reduced-motion` shows the answer at once.

```text
┌ Transcript ───────────────────────────────────────────────────┐  ┌ Run inspector ───────────────┐
│ You                                                            │  │ Before your first run        │
│ How much of the annual cap does the spring budget use?         │  │ (fills in when the answer    │
│ ────────────────────────────────────────────────────────────── │  │  finishes)                   │
│ Funding pre-check  [Demo runtime: placeholder answer]          │  │                              │
│ ✓ Checked access as Startup Club · Treasurer                   │  │                              │
│ ✓ Read 3 of 3 permitted documents                              │  │                              │
│ ◷ Writing the answer                                           │  │                              │
│                                                                │  │                              │
│ Placeholder answer. The demo runtime doesn't call a model.     │  │                              │
│ Here is the first line of each document this run could read:   │  │                              │
│ 1. Sponsor contacts: Two local sponsors have pledged support   │  │                              │
│    for pitch night. [1]                                        │  │                              │
│ 2. Spring 2026 budget: The spring budget is $6,200 acr▍        │  │                              │
│ ┌────────────────────────────────────────────────────────────┐ │  │                              │
│ │ You can type the next message; Enter waits for this answer │ │  │                              │
│ │ [Standard ▾]  ≈ 3 credits       489 left · Dec 1  [ ■ Stop ]│ │  │                              │
│ └────────────────────────────────────────────────────────────┘ │  │                              │
│ Esc or Stop stops showing the answer. The run has finished.    │  │                              │
└────────────────────────────────────────────────────────────────┘  └──────────────────────────────┘

After Stop, under the partial text:
│ ◷ Stopped showing the answer. The run had already finished and cost 3 credits. [ Show full answer ] │
```

**C4 · Mid-conversation, with citations** (Taylor, Funding pre-check, the second run, popover open
on source 2)

```text
┌ Transcript ───────────────────────────────────────────────────┐  ┌ Run inspector ───────────────┐
│ You                                                            │  │ Run 2 of 2                   │
│ How much of the annual cap does the spring budget use?         │  │ ✓ Checked access · 4 grants  │
│ ... first answer · Standard · −3 credits · Audit #418 ...      │  │ ✓ Read 3 of 3 permitted docs │
│ ────────────────────────────────────────────────────────────── │  │ ✓ Paid by Startup Club ·     │
│ ⓘ USG Funding Department Guidelines is now v2.                 │  │   3 credits · Audit #431     │
│ ────────────────────────────────────────────────────────────── │  │ Run grants                   │
│ You                                                            │  │   Any signed-in student      │
│ And with the new cap?                                          │  │   Startup Club · Member      │
│ ────────────────────────────────────────────────────────────── │  │   Startup Club · Treasurer   │
│▌Funding pre-check  [Demo runtime: placeholder answer]          │  │ Sources                      │
│▌                           [lock] Uses Officers information    │  │   Startup Club · Finance     │
│▌Placeholder answer. The demo runtime doesn't call a model.     │  │   USG rulebook               │
│▌Here is the first line of each document this run could read:   │  │ Documents                    │
│▌1. Sponsor contacts: Two local sponsors have pledged support   │  │   Permitted               3  │
│▌   for pitch night. [1]                                        │  │   Sponsor contacts [Officers]│
│▌2. Spring 2026 budget: The spring budget is $6,200 across      │  │ ▌ Spring 2026 budget         │
│▌   three events. [2]                                           │  │ ▌            [Officers]      │
│▌3. USG Funding Department Guidelines: Individual               │  │  USG Funding Department      │
│▌   organizations may receive a maximum of $8,000               │  │  Guidelines     [Public]     │
│▌   from the USG Funding Department per year. [3]               │  │                              │
│▌USG Funding Department Guidelines (v2) is in this run.         │  │   Read in this run        3  │
│▌Sources [1 Sponsor contacts · Officers]                        │  │ Versions                     │
│▌        [2 Spring 2026 budget · Officers]                      │  │   Template v1                │
│▌        [3 USG Funding Department Guidelines · Public]         │  │   USG Funding Guidelines v2  │
│▌        ┌──────────────────────────────────────────────┐       │  │   Model Standard             │
│▌        │ Source 2                                      │       │  │ Billing                      │
│▌        │ Spring 2026 budget                [Officers]  │       │  │   Paid by    Startup Club    │
│▌        │ "The spring budget is $6,200 across three     │       │  │   This run   3 credits       │
│▌        │  events."                                     │       │  │              ($0.03)         │
│▌        │ Officers: readable through your Treasurer     │       │  │   Left       486 credits     │
│▌        │ position.                                     │       │  │              ($4.86)         │
│▌        │ Open in document · Show in inspector          │       │  │ History                      │
│▌        └──────────────────────────────────────────────┘       │  │   Earlier messages: not sent │
│▌Standard · −3 credits · Read 3 of 3 permitted documents ·      │  │ Audit                        │
│▌Audit #431                                     [ Copy ] [Details]│  │   Audit event         #431   │
└────────────────────────────────────────────────────────────────┘  └──────────────────────────────┘
```

- `[n]` in the text and each chip in the sources row are buttons. Focus or click opens the
  popover; hover also opens it on desktop; Escape closes it. "Show in inspector" highlights the
  document row (`▌`).
- Reason line by tier: "Public: readable by any signed-in student." · "Members: readable through
  your Startup Club membership." · "Officers: readable through your Treasurer position." · "USG
  internal: readable through your USG position."
- Tier label hover text: "This answer quotes Spring 2026 budget (Officers). Check before sharing
  it outside the officer team." For Members answers: "Keep it within Startup Club." Public answers
  get no label.
- The balance on Startup Club's budget, under the demo sequence (section 9):
  - 500 credits ($5.00), less Lee's four seeded runs, Lee's run and Casey's run: 492;
  - after Taylor's first run: 489;
  - after the run shown: 486.

**C5 · Blocked** (Casey, Club handoff, after Sam sets Casey's allowance to $0.00 in D5)

```text
┌ Transcript ───────────────────────────────────────────────────┐  ┌ Run inspector ───────────────┐
│ You                                                            │  │ Run 1 of 1                   │
│ What did we decide at the Oct 8 meeting?                       │  │ (a blocked message makes no  │
│ ... answer · Standard · −3 credits · Audit #409                │  │  run, so the last run stays  │
│ ────────────────────────────────────────────────────────────── │  │  shown)                      │
│ You                                                            │  │                              │
│ Who is taking over as treasurer?                               │  │                              │
│ ┌ [!] Blocked before the agent ran ──────────────────────────┐ │  │                              │
│ │ Your allowance in Startup Club is 0 credits this month.    │ │  │                              │
│ │ Ask Sam, your club president, to raise it.                 │ │  │                              │
│ │ Nothing was charged. The block is in the audit log.        │ │  │                              │
│ └────────────────────────────────────────────────────────────┘ │  │                              │
│ ┌────────────────────────────────────────────────────────────┐ │  │                              │
│ │ Ask Club handoff                                           │ │  │                              │
│ │ [Standard ▾]  ≈ 3 credits    0 credits left [100% used]     │ │  │                              │
│ │                                                [ ↑ Run ]   │ │  │                              │
│ └────────────────────────────────────────────────────────────┘ │  │                              │
└────────────────────────────────────────────────────────────────┘  └──────────────────────────────┘

Blocked on load (Lee reopens Recruiting Q&A after her one run), above the composer:
│ ┌ [!] You've used today's 5 credits for public agents. They reset at midnight PT. ─────────────┐ │
│ └──────────────────────────────────────────────────────────────────────────────────────────────┘ │
Run stays enabled; pressing it returns the same message from the gateway as a transcript note.
Access block: "[!] Blocked by the access check" + "You are not in the audience for Funding pre-check."
+ "Ask Startup Club's president if you need access. Nothing was charged."
Failure: "Couldn't get an answer. If the run went through, it was billed and recorded." [ Try again ]
```

**C6 · Pending write action** (Taylor, Funding pre-check). The mock proposes `submit_to_queue`
when the agent has the tool and the message contains "submit"; the gateway turns it into a pending
action (I6). The card is the existing one.

```text
┌ Transcript ───────────────────────────────────────────────────┐  ┌ Run inspector ───────────────┐
│ You                                                            │  │ Run 3 of 3                   │
│ Submit the founder panel request for $1,800 to the USG queue.  │  │ ✓ Checked access · 4 grants  │
│ ────────────────────────────────────────────────────────────── │  │ ✓ Read 3 of 3 permitted docs │
│▌Funding pre-check  [Demo runtime: placeholder answer]          │  │ ✓ Paid by Startup Club ·     │
│▌                           [lock] Uses Officers information    │  │   3 credits · Audit #436     │
│▌Placeholder answer. ... three numbered lines ...               │  │ ...                          │
│▌USG Funding Department Guidelines (v2) is in this run.         │  │                              │
│▌Sources [1 Sponsor contacts · Officers] [2 Spring 2026 ...]    │  │                              │
│▌┌ Submit to queue ──────────────────────── [◷ Waiting for you] ┐│  │                              │
│▌│ submit_to_queue                                             ││  │                              │
│▌│ Waits for you to confirm. Nothing runs until you do.        ││  │                              │
│▌│ [ Confirm ]  [ Reject ]                                     ││  │                              │
│▌└─────────────────────────────────────────────────────────────┘│  │                              │
│▌Standard · −3 credits · Read 3 of 3 permitted documents ·      │  │                              │
│▌Audit #436                                                     │  │                              │
└────────────────────────────────────────────────────────────────┘  └──────────────────────────────┘

After Confirm:  ✓ Confirmed and recorded in the audit log.
After Reject:   ⊘ Rejected. Nothing ran.
```

After D7 moves the treasurer position to Jordan, the gateway refuses Taylor's Confirm on a new card
(`confirmerPositions`), and the card shows its existing final-refusal copy.

### 5.4 Behaviour

- **Keys:**
  - Enter runs, Shift+Enter adds a line, Ctrl/Cmd+Enter runs.
  - Enter is ignored while `event.nativeEvent.isComposing`.
  - During playback, typing is allowed, Enter waits and Esc stops.
  - The model menu works by keyboard: arrows move, Enter picks.
- **Validation:** an empty message gets "Write a message first."; one over 8,000 characters keeps
  today's copy (`run-workspace.tsx:28-35`). A counter appears from 7,000 characters.
- **Starters:** a click fills the composer and focuses it. Starters disappear after the first run.
- **Change notes** between two runs, from the two inspectors:
  - "Your access changed since your last run: Startup Club · Treasurer no longer applies."
  - "USG Funding Department Guidelines is now v2."
  - "Funding pre-check was updated to template v2."
- **Copy** copies the answer's Markdown plus "Sources: 1. Sponsor contacts ...". The button reads
  "Copied" for two seconds.
- **Live region:** one `aria-live="polite"` region announces "Checking access and quota", then
  "Funding pre-check answered. Read 3 documents. 3 credits used, 486 left." It never reads single
  words. The playing turn is `aria-busy`.
- **Times:** messages show no timestamps. Client code can't read the clock
  (`scripts/check.ts:85-93`), and the browser's clock would contradict `DEMO_NOW`. The audit
  number is the reference.
- **Persona safety:** key `<RunWorkspace>` by `userId:activeOrgId:installationId`, as the directory
  page keys its form (`src/app/directory/[installationId]/page.tsx:35`).

### 5.5 Data the chat page needs

No `contracts.ts` change. `getRunPageData` (`src/lib/documents/run-page.ts:69-115`, C) gains:

```ts
scope: { sentence: string; grantLabels: string[]; sources: string[]; billedClub: string };
models: {
  allowed: Array<{ modelClass: ModelClass; priceMicro: number }>;   // LoadedAgent.allowedModelClasses (B) + prices (A)
  defaultClass: ModelClass;                                         // the agent's resolved class
  fixedByClub: boolean;                                             // the installation sets a class
  limitedByTemplate: boolean;                                       // the version allows fewer classes than USG
};
quota: { scope: QuotaScope; remainingMicro: number; limitMicro: number; spentMicro: number; resetsAt: string };  // quotaLine() (A)
starters: string[];                                                 // STARTERS[templateSlug] (C fixture)
```

The request becomes `POST /api/agents/:installationId/runs { input, modelClass }`. The directory
page (D) calls the same `getRunPageData`, so both pages show the same scope, models, balance and
starters.

Starters (`src/lib/documents/fixtures.ts`, C; later a template-version field owned by B):

| Template | Starters |
|---|---|
| `recruiting-qa` | Do I need experience to join Startup Club? · How does recruiting work? · Does membership cost anything? |
| `showcase-qa` | When and where is the spring showcase? · Are tickets free for students? · How can I help backstage? |
| `handoff` | What did we decide at the Oct 8 meeting? · How did pitch night go last year? · What should a new treasurer know first? |
| `funding-precheck` | How much of the annual cap does the spring budget use? · When are funding requests due? · Submit the founder panel request for $1,800 to the USG queue. |
| `event-planning` | How far ahead should we book a room? · What should we change about check-in? |
| `usg-review-assistant` | What do reviewers check first? · Which requests should be flagged? |

Mock reply v2 (`src/lib/runtime/mock.ts`, A). It keeps today's documents and citations, writes them
as Markdown with `[n]` markers that index `citations`, and keeps the rule-pack line verbatim for D6
(`tests/gateway.test.ts:91`):

```text
**Placeholder answer.** The demo runtime doesn't call a model. Here is the first line of each
document this run could read:

1. **Sponsor contacts:** Two local sponsors have pledged support for pitch night. [1]
2. **Spring 2026 budget:** The spring budget is $6,200 across three events. [2]
3. **USG Funding Department Guidelines:** Individual organizations may receive a maximum of $8,000 from the USG Funding Department per year. [3]

```

## 6. Usage and allowance pages

### 6.1 Usage, for students

`/me/usage`. D owns the page (`src/app/me/usage/**`) and adds "Usage" under the My agents scope
(`src/components/shell/navigation.ts:18`). The data comes from A's `myUsage(actor)`
(`src/lib/gateway/usage.ts`):
- runs from `agent_runs` inside `withActor`, which `runs_own` limits to the viewer's own rows;
- agent and club names from installations and templates;
- allowances from `remaining()`;
- the count of blocked attempts from the viewer's own `quota.blocked` audit rows.

**U1 · Usage** (Casey, after D4)

```text
│ Usage                                                                                             │
│ Your AI credits and runs. Only you can see this page.                                             │
│ ┌ Allowances ────────────────────────────────────────────────────────────────────────────────────┐│
│ │ Startup Club · monthly    ▓▓░░░░░░░░░░░░░░░░░░   47 of 50 credits left     Resets Dec 1, 2026   ││
│ │ Public agents · daily     ░░░░░░░░░░░░░░░░░░░░    5 of 5 credits left      Resets at midnight PT││
│ └────────────────────────────────────────────────────────────────────────────────────────────────┘│
│ Runs, last 30 days                                                         3 credits this month   │
│ ┌───────────────────────────┬──────────────────┬──────────┬──────────────┬───────────┬─────────┐  │
│ │ Time                      │ Agent            │ Model    │ Club billed  │ Documents │ Credits │  │
│ │                           │                  │          │              │ read      │         │  │
│ ├───────────────────────────┼──────────────────┼──────────┼──────────────┼───────────┼─────────┤  │
│ │ Nov 15, 2026, 10:44 AM PT │ Club handoff     │ Standard │ Startup Club │         3 │      −3 │  │
│ └───────────────────────────┴──────────────────┴──────────┴──────────────┴───────────┴─────────┘  │
│ Only you can see this list. Startup Club's president and USG see the same run details, never       │
│ your questions or the answers.                                                                    │
```

- The meters follow the quota meter rule: 8px bar, `#E0E0E0` track, Cardinal fill, and the
  "80% used" chip at 80% or more. Lee sees one meter, "Public agents · daily", at "1 of 5 credits
  left [80% used]".
- Columns: Time (Source Code Pro, absolute, PT), Agent, Model, Club billed, Documents read, and
  Credits (right-aligned, tabular). Rows are newest first, 20 per page, with a monthly total. A
  failed run shows "Failed · 0 credits".
- The table holds no question text: it is about spend, and it matches what clubs see. A later
  "Open run" link could show the viewer's own run read-only.
- "Blocked attempts this month: 1. Nothing was charged." appears above the table when the count
  isn't zero.

| State | What shows |
|---|---|
| Loading | Skeleton meters and five skeleton rows |
| Nothing yet | "No runs yet. Your runs, the model each used and what it cost appear here." [ Open My agents ] |
| No club | Only the "Public agents · daily" meter |
| Error | Banner: "Couldn't load your usage. Try again in a moment." [ Try again ] |
| Signed out | "Choose a persona to sign in." link |

The club home's "My usage" section (`src/app/org/[orgId]/club-home-sections.tsx:203-209`, B)
switches to credits and links to Usage.

### 6.2 Administration: allowances and models, for presidents

`/org/[orgId]/admin` is planned WP-7 work (B). D5 (member limits) and D7 (transfer) need it, and
the model control gives D2's rejected widening a place in the UI. The additions here are the
dollars-and-credits display and the "Model for members" column.

**U2 · Administration** (Sam)

```text
│ Administration                                                                                    │
│ Startup Club · Members, positions, allowances and agents.                                         │
│ Club budget  $4.83 of $5.00 left this month · 483 of 500 credits · set by USG · resets Dec 1      │
│ ... Members and positions, with Transfer (D7) ...                                                 │
│ Allowances                                                                                        │
│ ┌──────────┬─────────────────────┬──────────────────────────────┬─────────────────────┬─────────┐ │
│ │ Member   │ Positions           │ Monthly allowance            │ Used this month     │         │ │
│ ├──────────┼─────────────────────┼──────────────────────────────┼─────────────────────┼─────────┤ │
│ │ Casey    │ Member              │ $0.50 · 50 credits           │ $0.03 · 3 credits   │ [ Edit ]│ │
│ │ Jordan   │ Member              │ Club budget                  │ $0.00               │ [ Edit ]│ │
│ │ Morgan   │ Member              │ Club budget                  │ $0.00               │ [ Edit ]│ │
│ │ Sam      │ President           │ Club budget                  │ $0.00               │ [ Edit ]│ │
│ │ Taylor   │ Treasurer, Member   │ Club budget                  │ $0.09 · 9 credits   │ [ Edit ]│ │
│ └──────────┴─────────────────────┴──────────────────────────────┴─────────────────────┴─────────┘ │
│ Agents and models                                                                                 │
│ ┌────────────────────┬───────────────────────────────────┬────────────────────┬─────────────────┐ │
│ │ Agent              │ Model for members                 │ Allowed by USG     │ Agent budget    │ │
│ ├────────────────────┼───────────────────────────────────┼────────────────────┼─────────────────┤ │
│ │ Club handoff       │ [ Members choose · default Std ▾ ]│ Economy, Standard  │ Club budget     │ │
│ │ Event planning     │ [ Members choose · default Eco ▾ ]│ Economy            │ Club budget     │ │
│ │ Funding pre-check  │ [ Members choose · default Std ▾ ]│ Economy, Standard  │ Club budget     │ │
│ │ Recruiting Q&A     │ [ Economy only               ▾ ]  │ Economy, Standard  │ $2.50 · 250 cr. │ │
│ └────────────────────┴───────────────────────────────────┴────────────────────┴─────────────────┘ │
```

- The "Model for members" options are "Members choose (default {version default})", "Economy only"
  and "Standard only". They write the installation's model class through `updateInstallation`
  (`src/lib/distribution/install.ts:15`): null, `economy` or `standard`.
- D2: Sam picks "Standard only" for Event planning, and the row shows "[!] Event planning may run on
  Economy only: its USG template allows Economy. Recorded in the audit log." This is the existing
  clamp (`clamps.ts:142-144`), which writes `installation.rejected`.
- Edit allowance is a dialog with the input in dollars and credits shown live: "$0.50 = 50 credits.
  Up to Startup Club's budget, $5.00." Setting $0.00 asks for confirmation: "Set Casey's allowance
  to $0.00? Casey's next run in Startup Club will be blocked until you raise it." (D5)
- "Allowed by USG" is the version ∩ policy list, read-only, with the reason on hover: "Event
  planning's USG template allows Economy only."

### 6.3 USG clubs: budgets, models and prices

`/usg/clubs` is planned WP-6 work (B). It needs B's `setClubPolicy` service, which isn't built,
for the route already listed in §14 (`docs/architecture.md:724`). It is P1, because no D1–D8 beat
needs it.

**U3 · Clubs and quotas** (Avery)

```text
│ Clubs and quotas                                                                                  │
│ Budgets and model access for every club. 1 credit = $0.01.                                        │
│ Platform  $50.00 a month · $0.17 used        Student daily allowance  $0.05 · 5 credits  [ Edit ] │
│ Prices per message (demo)  Economy 1 credit ($0.01) · Standard 3 credits ($0.03)                  │
│ ┌───────────────┬──────────────────────┬──────────────────┬─────────────────────────┬───────────┐ │
│ │ Club          │ Monthly budget       │ Used this month  │ Models clubs may use    │ Public    │ │
│ ├───────────────┼──────────────────────┼──────────────────┼─────────────────────────┼───────────┤ │
│ │ Archery Club  │ $5.00 · 500  [ Edit ]│ $0.00            │ [x] Economy [x] Standard│ Allowed   │ │
│ │ Dance Club    │ $5.00 · 500  [ Edit ]│ $0.00            │ [x] Economy [x] Standard│ Allowed   │ │
│ │ Robotics Club │ $5.00 · 500  [ Edit ]│ $0.00            │ [x] Economy [x] Standard│ Allowed   │ │
│ │ Startup Club  │ $5.00 · 500  [ Edit ]│ $0.17 · 17       │ [x] Economy [x] Standard│ Allowed   │ │
│ └───────────────┴──────────────────────┴──────────────────┴─────────────────────────┴───────────┘ │
```

- Unchecking Standard for a club opens a confirm dialog that names the effect: "Club handoff and
  Funding pre-check will run on Economy in Startup Club."
- An installation fixed to Standard would no longer pass the clamps (`clamps.ts:142-144`), so the
  service must reset such overrides, or refuse with their names, before saving.
- Prices are read-only demo constants. After WP-13 they come from the provider's prices (§17).

## 7. Knowledge pages

Only Dify's knowledge-base UX is in scope, not its workflow and orchestration canvas: templates
(B) configure agents. The club's sources are the knowledge bases and Documents is the
knowledge-base area, so nothing duplicates the library. The Retrieval test sits beside the access
matrix because it simulates positions, as the matrix does.

| Page | Route | Who | Owner (path) | New §14 page row |
|---|---|---|---|---|
| Documents (knowledge base) | `/org/[orgId]/documents` | readers of the club library | C | no |
| Sources | `/org/[orgId]/documents/sources` | same | C | yes (P1) |
| Document | `/org/[orgId]/documents/[documentId]` | anyone who can read it | C | yes |
| Retrieval test | `/org/[orgId]/preview/retrieval` | club president, club active | C | yes |
| Upload with review | Sheet on Documents | club president | C | no |
| Quick look | Sheet on the run pages (P1) | anyone who can read it | C | no (server action) |

### 7.1 Demo index (`src/lib/documents/fixtures.ts`, C)

Deterministic and derived from `documents.body_md`. No model, no embeddings, and never called by
a run.

```ts
export const DEMO_INDEX = {
  label: 'Demo index',
  maxChunkChars: 800,      // split at ##/### headings, then at blank lines
  minIndexableChars: 40,   // less text than this: error 'too_short'
  queuedMs: 3_000,         // uploads only; seeded documents are always ready
  msPerChunk: 2_000,
} as const;

export interface DemoChunk {
  n: number;               // 1-based, shown as "Chunk 01"
  heading: string;         // "Introduction" for text before the first heading
  text: string;            // exact substring of body_md
  start: number;           // offset of text in body_md, for highlighting
  chars: number;
  tokens: number;          // Math.ceil(chars / 4), shown as "about 41 tokens"
}

export type IndexStatus =
  | { state: 'queued' }
  | { state: 'indexing'; done: number; total: number }
  | { state: 'ready' }
  | { state: 'error'; reason: 'too_short'; message: string; fix: string };

export function demoChunks(bodyMd: string): DemoChunk[];
/** Seeded ids (db/seed/ids.ts) are always ready; uploads move queued → indexing → ready by clock.now(). */
export function demoStatus(doc: { id: string; bodyMd: string; createdAt: Date }, at: Date): IndexStatus;
/** Share of the question's distinct words (stop words dropped, plural -s folded) found in the chunk. */
export function demoScore(question: string, chunk: Pick<DemoChunk, 'heading' | 'text'>): { score: number; matched: string[] };
export const STARTERS: Record<string, string[]>;
```

What it produces on the seed:

| Document | Tier | Chunks (characters) |
|---|---|---|
| Recruiting FAQ | Public | 01 Introduction (105) · 02 Who can join (83) · 03 How recruiting works (196) · 04 What members do (213) · 05 Cost (48) |
| Meeting minutes 2026-10-08 | Members | 01 Introduction (158) · 02 Decisions (226) · 03 Action items (265) · 04 Next meeting (73) |
| Past events and venues | Members | 01 Introduction (147) · 02 Pitch night 2025 (267) · 03 Spring kickoff 2026 (169) · 04 Booking notes (180) |
| Spring 2026 budget | Officers | 01 Introduction (164) · 02 By event (83) · 03 By line (166) · 04 Notes (264) |
| Sponsor contacts | Officers | 01 Introduction (157) · 02 Sponsors (202) · 03 Handling (247) · 04 Handoff (80) |
| USG Funding Department Guidelines | Public | 01 Introduction (495) · 02 §1 Application timeline (1998) · 03 §2 Application overview (3105) · 04 §3 Maximum funding (929) · 05 §4 Funding boards (3207) · 06 §5 General guidelines (1995) · 07 §6 Policy and denials (1475) · 08 §7 Approval and amendments (272) |

- An upload is queued for 3s, then indexes one chunk every 2s, then is ready: a three-chunk
  document is ready about 9s after upload.
- Documents refreshes every 2s while a row isn't ready, and stops after 60s.
- The index runs on the demo clock.

### 7.2 Documents, the knowledge base

`/org/[orgId]/documents` keeps today's search, tier filter, pagination and president-only upload,
and adds access and index columns.

**K1 · Ready, with one upload indexing** (Sam, after D3–D6 and one upload). Source names are
shortened here; the page shows "Startup Club · Minutes".

```text
│ Documents                                                                     [ Upload document ] │
│ Startup Club · The documents agents draw on, who can read each one, and its index status.         │
│ [ Documents ]  Sources                                                              [Demo index]  │
│ Search documents          Source             Tier             Status                              │
│ [                      ]  [All sources ▾]    [All tiers ▾]    [All ▾]                7 documents  │
│ ┌─────────────────────────────┬──────────┬──────────────────────┬────────────────┬──────┬────────┬───────┐
│ │ Title                       │ Source   │ Who can read         │ Status         │Chunks│ Agents │ Cited │
│ ├─────────────────────────────┼──────────┼──────────────────────┼────────────────┼──────┼────────┼───────┤
│ │ Pitch night run of show     │ Minutes  │ All members          │ ◷ Indexing 1/3 │    – │ 2 of 4 │     0 │
│ │ Meeting minutes 2026-10-08  │ Minutes  │ All members          │ ✓ Ready        │    4 │ 2 of 4 │     2 │
│ │ Past events and venues      │ Archive  │ All members          │ ✓ Ready        │    4 │ 2 of 4 │     1 │
│ │ Recruiting FAQ              │ Public   │ All students         │ ✓ Ready        │    5 │ 2 of 4 │     2 │
│ │ Sponsor contacts            │ Finance  │ Treasurer, President │ ✓ Ready        │    4 │ 2 of 4 │     3 │
│ │ Spring 2026 budget          │ Finance  │ Treasurer, President │ ✓ Ready        │    4 │ 2 of 4 │     3 │
│ │ USG Funding Department      │ USG      │ All students         │ ✓ Ready        │    8 │ 1 of 4 │     3 │
│ │ Guidelines                  │ rulebook │                      │                │      │        │       │
│ └─────────────────────────────┴──────────┴──────────────────────┴────────────────┴──────┴────────┴───────┘
│ Indexing updates every few seconds.                    (Uploaded column, "Nov 15, 2026, 10:51 AM PT") │
```

- **Who can read:**
  - "All students" for Public and "All members" for Members;
  - for Officers, the position names with President last ("Treasurer, President");
  - "Reviewer, Admin" for USG internal.
  C builds it from `tier`, `allowed_positions` and position names in its own query, without
  changing `LibraryDocument`.
- **Agents:** this club's installations that can read the document for at least one position
  (`explainAccess` per subject). The link opens the document page. Non-members count public agents
  only, because the catalog is for members.
- **Cited (30 days):** completed runs of this club's agents whose `cited_document_ids` include the
  document, from `agent_runs_meta` through A's `citedCounts()`. It is shown to the club president
  and USG admins. The numbers are real, so they rise during the demo and match the audit log.
- **Status** is icon plus word. A row click opens the document page.

| State | What shows |
|---|---|
| Loading | Header, toolbar and eight skeleton rows (`loading.tsx`) |
| Nothing yet, president | "No documents yet. Upload the club's first document, such as meeting minutes, a budget or an FAQ." [ Upload document ] |
| Nothing yet, others | "No documents are available to you yet. Ask the club president to share one with your position." |
| No results | "0 of 7 documents match these filters." [ Clear filters ] |
| Indexing | The row updates live; the polite live region says "Pitch night run of show is ready." |
| Error row | "[!] Error · Too short to index. Upload a version with at least one full sentence." |
| Load error | Banner: "Couldn't load the documents. Try again in a moment." [ Try again ] |
| Not a member | Public documents only, with "You see Startup Club's public documents only." |

### 7.3 Sources (P1)

`/org/[orgId]/documents/sources`, one row per source.

**K2 · Sources**

```text
│ [ Documents ]  [ Sources ]                                                          [Demo index]  │
│ ┌──────────────────────────┬──────────┬───────────┬────────┬───────────────┬──────────────────────────────────┐
│ │ Source                   │ Kind     │ Documents │ Chunks │ Status        │ Read by agents                   │
│ ├──────────────────────────┼──────────┼───────────┼────────┼───────────────┼──────────────────────────────────┤
│ │ Startup Club · Public    │ Public   │         1 │      5 │ ✓ Ready       │ Club handoff, Recruiting Q&A     │
│ │ Startup Club · Minutes   │ Minutes  │         2 │      4 │ ◷ 1 of 2 ready│ Club handoff, Event planning     │
│ │ Startup Club · Archive   │ Archive  │         1 │      4 │ ✓ Ready       │ Club handoff, Event planning     │
│ │ Startup Club · Finance   │ Finance  │         2 │      8 │ ✓ Ready       │ Club handoff, Funding pre-check  │
│ │ USG rulebook             │ Rulebook │         1 │      4 │ ✓ Ready       │ Funding pre-check                │
│ └──────────────────────────┴──────────┴───────────┴────────┴───────────────┴──────────────────────────────────┘
│ Counts include only documents you can read. A row opens Documents filtered to that source.        │
```

- A source with no documents you can read shows "–" and the status "No documents".
- A load error is a banner.
- Non-members see only sources that hold public documents, and only public agents.

### 7.4 Document page

`/org/[orgId]/documents/[documentId]`: Dify's chunk view plus our access panel. P0 is the Chunks
tab and the details panel; the Text and Access tabs are P1.

**K3 · Chunks tab** (Sam, Spring 2026 budget)

```text
│ Documents / Spring 2026 budget                                                                    │
│ Spring 2026 budget                                                             [ Test retrieval ] │
│ Startup Club · Finance · Version 1                                                                │
│ ┌ Main, max 720 ─────────────────────────────────────────────────┐ ┌ Details, 384 ──────────────────┐
│ │ [ Chunks (4) ]  Text   Access                       [Demo index]│ │ Status    ✓ Ready              │
│ │ 4 chunks · split at headings · each chunk inherits Officers:    │ │ Tier      [Officers]           │
│ │ Treasurer, President                                            │ │ Source    Startup Club ·       │
│ │ [ Search chunks                  ]                              │ │           Finance              │
│ │ ─────────────────────────────────────────────────────────────── │ │ Version   1                    │
│ │ Chunk 01 · Introduction                164 characters · about 41│ │ Uploaded  Nov 15, 2026,        │
│ │ The spring budget is $6,200 across three events. Catering is the│ │           10:00 AM PT, by Sam  │
│ │ largest line at $2,400. Prepared by Taylor (treasurer) and      │ │ Size      718 characters       │
│ │ approved by Sam (president). Demo text.                         │ │ Index     Demo index: split at │
│ │ ─────────────────────────────────────────────────────────────── │ │           headings, up to 800  │
│ │ Chunk 02 · By event                     83 characters · about 21│ │           characters, no       │
│ │ - Spring kickoff: $1,400  - Founder panel: $1,800               │ │           embeddings           │
│ │ - Demo day: $3,000  - Total: $6,200                             │ │ ────────────────────────────── │
│ │ ─────────────────────────────────────────────────────────────── │ │ Who can read                   │
│ │ Chunk 03 · By line                     166 characters · about 42│ │   Treasurer, President         │
│ │ - Catering: $2,400  - Venue and audio-visual: $1,500  - ...     │ │   Members without these        │
│ │ ─────────────────────────────────────────────────────────────── │ │   positions see it as          │
│ │ Chunk 04 · Notes                       264 characters · about 66│ │   Restricted document.         │
│ │ - The total is under the USG annual cap of $8,000, and three    │ │ ────────────────────────────── │
│ │ events is under the limit of 4 per semester. - ...              │ │ Agents                         │
│ └─────────────────────────────────────────────────────────────────┘ │   Funding pre-check ✓ Allowed  │
│                                                                     │   for Treasurer and President  │
│                                                                     │   runs                         │
│                                                                     │   Club handoff      ✓ Allowed  │
│                                                                     │   for Treasurer and President  │
│                                                                     │   runs                         │
│                                                                     │   Recruiting Q&A ⊖ Outside     │
│                                                                     │   agent sources · reads Public │
│                                                                     │   only                         │
│                                                                     │   Event planning ⊖ Outside     │
│                                                                     │   agent sources · reads Minutes│
│                                                                     │   and Archive only             │
│                                                                     │ ────────────────────────────── │
│                                                                     │ Cited in runs                  │
│                                                                     │   3 runs in the last 30 days · │
│                                                                     │   last by Funding pre-check    │
│                                                                     └────────────────────────────────┘
```

- "Test retrieval" (president) opens the Retrieval test with the first agent that reads this
  source.
- Each chunk carries `id="chunk-02"`, and links from the Retrieval test land on that anchor and
  highlight it.
- Agent rows use the labels and icons in `src/components/inspector/access-labels.ts:23-28`. "Above
  agent max tier" would appear for an Officers document in Minutes read through Event planning (max
  tier Members); no seed document hits it.

**K3 states**

```text
Indexing (an upload, 4s old):
│ ◷ Indexing · 1 of 3 chunks. The demo index finishes in a few seconds.                             │
│ Chunk 01 · Introduction     61 characters · about 16 tokens                                       │
│ Run of show for pitch night on Nov 20. Doors open at 6:30 PM.                                     │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (skeleton rows for chunks 02 and 03)                           │

Error:
│ ┌ [!] Couldn't index this document ──────────────────────────────────────────────────────────────┐│
│ │ It has fewer than 40 characters of text. Upload a version with at least one full sentence.      ││
│ └─────────────────────────────────────────────────────────────────────────────────────────────────┘│
│ Chunks (0) · No chunks yet.                                                                       │

Restricted (no title, no id, and the same page for an id that doesn't exist):
│ Restricted document                                                                               │
│ You can't read this document. If you need it, ask Startup Club's president.                       │
│ [ Back to documents ]                                                                             │

Loading: header skeleton, four chunk skeleton rows, details skeleton.
```

**K3b · Text tab (P1)** renders the Markdown with chunk numbers in the left margin, and highlights
`#chunk-NN` or a selected chunk.

**K3c · Access tab (P1)**, president only: positions by agents for this one document, using the
preview's cell explanation.

```text
│ Who can read Spring 2026 budget through each agent                                                │
│ ┌───────────────────────┬────────────────┬───────────────────┬────────────────────────┬────────────────────────┐
│ │ Position              │ Club handoff   │ Funding pre-check │ Recruiting Q&A         │ Event planning         │
│ ├───────────────────────┼────────────────┼───────────────────┼────────────────────────┼────────────────────────┤
│ │ Any signed-in student │ [lock] Not gr. │ [lock] Not granted│ ⊖ Outside agent sources│ ⊖ Outside agent sources│
│ │ Member                │ [lock] Not gr. │ [lock] Not granted│ ⊖ Outside agent sources│ ⊖ Outside agent sources│
│ │ President             │ ✓ Allowed      │ ✓ Allowed         │ ⊖ Outside agent sources│ ⊖ Outside agent sources│
│ │ Secretary             │ [lock] Not gr. │ [lock] Not granted│ ⊖ Outside agent sources│ ⊖ Outside agent sources│
│ │ Treasurer             │ ✓ Allowed      │ ✓ Allowed         │ ⊖ Outside agent sources│ ⊖ Outside agent sources│
│ └───────────────────────┴────────────────┴───────────────────┴────────────────────────┴────────────────────────┘
│ The agent's audience separately decides who may run it.                                           │
```

### 7.5 Retrieval test

`/org/[orgId]/preview/retrieval` is a second tab on Permission preview: Dify's Retrieval test, run
as a position. The permission filter is real; the scores are demo.

How a test runs (`src/lib/documents/retrieval-test.ts`, C):
1. `requirePreviewPresident` (`src/lib/documents/preview.ts:11-18`).
2. Candidates: the documents the president reads in the club's sources, the USG rulebook and the
   agent's sources, read inside `withActor` as `listBlockedDocuments` does
   (`src/lib/documents/access.ts:80-86`).
3. For each subject in the preview's list, decide each candidate with
   `explainAccess(subject.grants, agent, doc)`. `tests/documents.test.ts` already holds it equal to
   RLS.
4. Chunk with `demoChunks` and score with `demoScore`. A hit scores at or above the threshold. The
   top K allowed hits are retrieved; the hits that aren't allowed are "kept out".

**K4 · Results** (Sam, Club handoff, "catering budget", as Member). The numbers are what the demo
index computes on the seed.

```text
│ Permission preview                                                                                │
│ Startup Club · See which documents and chunks each position can reach through an agent.           │
│  Access matrix   [ Retrieval test ]                                                               │
│ ┌ Test, 360 ──────────────────────────┐ ┌ Results ────────────────────────────────────────────────┐
│ │ Agent                               │ │ 3 chunks retrieved for Member · Club handoff [Demo scores]│
│ │ [ Club handoff                   ▾] │ │ By position: Any signed-in student 0 · Member 3 ·        │
│ │ Test as                             │ │   Secretary 3 · Treasurer 8 · President 8                │
│ │ [ Member                         ▾] │ │ ──────────────────────────────────────────────────────── │
│ │ Question                            │ │ 1  0.50  Meeting minutes 2026-10-08  [Members]           │
│ │ [ catering budget                 ] │ │          Chunk 02 · Decisions                            │
│ │ Up to 200 characters. Ask it the    │ │          ... Jordan shadows Taylor on the ▓budget▓ and   │
│ │ way that person would.              │ │          the funding request ...                         │
│ │ ▸ Retrieval settings                │ │          Open in document                                │
│ │   Top K 3 · Score threshold 0.30    │ │ 2  0.50  Meeting minutes 2026-10-08  [Members]           │
│ │   For this test only.               │ │          Chunk 03 · Action items                         │
│ │ [ Test retrieval ]                  │ │          ... sit in on the ▓budget▓ review and note ...  │
│ │                                     │ │ 3  0.50  Past events and venues  [Members]               │
│ │ Try                                 │ │          Chunk 04 · Booking notes                        │
│ │ ( What did we decide at the Oct 8   │ │          ▓Catering▓ needs a named officer on site ...    │
│ │   meeting? )                        │ │ ──────────────────────────────────────────────────────── │
│ │ ( How did pitch night go last       │ │ Kept out by permissions · 5 chunks                       │
│ │   year? )                           │ │ These scored at least 0.30, but Member can't read them   │
│ │ ─────────────────────────────────── │ │ through Club handoff.                                     │
│ │ Tests in this session               │ │ 1.00  Spring 2026 budget  [Officers] · Chunk 01          │
│ │ 10:52 AM PT · Club handoff · Member │ │       [lock] Not granted                                 │
│ │   catering budget            3 hits │ │       Member → Startup Club · Member → needs Treasurer   │
│ │ 10:51 AM PT · Club handoff ·        │ │       or President. To change it, edit who can read the  │
│ │   Treasurer · catering budget  3    │ │       document.                                          │
│ └─────────────────────────────────────┘ │ 0.50  Spring 2026 budget  [Officers] · Chunk 03 By line   │
│                                         │       [lock] Not granted                                 │
│                                         │ 0.50  Sponsor contacts  [Officers] · Chunk 02 Sponsors    │
│                                         │       [lock] Not granted                                 │
│                                         │ Show 2 more                                              │
│                                         └──────────────────────────────────────────────────────────┘
```

- Choosing Treasurer in the By position line re-runs the test as Treasurer: Spring 2026 budget
  chunk 01 (1.00) comes first, and nothing is kept out.
- The same question through Recruiting Q&A retrieves nothing for anyone. Every kept-out chunk reads
  "⊖ Outside agent sources · Recruiting Q&A reads Startup Club's Public source only. Add the source
  in the catalog, if its template allows."
- Fix lines by reason:
  - Not granted: "To change it, edit who can read the document."
  - Outside agent sources: "Add the source in the catalog, if its template allows."
  - Above agent max tier: "Set by the USG template. Ask USG to raise the agent's max tier."
- Ties sort by matched word count, then document title, then chunk number. Scores use tabular
  figures, and matched words are highlighted with `bg-gold-25`.
- "Tests in this session" lives in client state, with the server's `testedAt` from `clock.now()`.
  Questions are never stored.
- The "Demo scores" chip reads: "Scores count the question's words found in each chunk. Which
  chunks each position can reach is the real permission check, the same one a run uses."

**K4 states**

```text
Before the first test:
│ Test what an agent retrieves for a position. Choose an agent, a position and a question.          │
│ Nothing runs, nothing is billed, and questions aren't saved.                                       │
│ Try ( What did we decide at the Oct 8 meeting? ) ( How did pitch night go last year? )             │

No hits (Recruiting Q&A, "catering budget", as Member):
│ No chunks scored at least 0.30 for Member through Recruiting Q&A.                                  │
│ Lower the threshold for this test, or check that the answer is in a document Member can read.     │
│ Kept out by permissions · 8 chunks   (the list still shows, which is the point)                   │

Not the president, or this club not active:
│ [lock] Only the club president can test retrieval, with this club active.                         │
│ Switch your persona or active club, or ask Sam, Startup Club's president.                          │

Loading: results skeleton. Error: banner "Couldn't run the test. Try again in a moment." [ Try again ]
```

### 7.6 Upload with review

Today's inline upload form (`src/app/org/[orgId]/documents/upload-form.tsx`) moves into a Sheet with
three steps, after Dify's "Data Source → Document Processing → Execute & Finish":
1. Details: today's fields (Title, Source, Tier, Positions for Officers, Markdown text).
2. Review access: who gains access, before anything is written
   (`.claude/agents/ui-designer.md:157-159`).
3. Index: the upload, then the live index status.

**K5 · Step 2, Review access** (Sam, a Members document in Minutes)

```text
┌ Upload document ──────────────────────────────── 1 Details  ›  2 Review access  ›  3 Index ── [ × ] ┐
│ Who gains access                                                                                   │
│ "Pitch night run of show" will be readable by all members of Startup Club.                         │
│ Agents that will read it: Club handoff (all members run it), Event planning (President and         │
│ Secretary run it).                                                                                 │
│ Can't read it: Recruiting Q&A and Funding pre-check (outside agent sources).                       │
│ ────────────────────────────────────────────────────────────────────────────────────────────────── │
│ Chunk preview · 3 chunks                                                            [Demo index]   │
│ Chunk 01 · Introduction      61 characters                                                         │
│ Chunk 02 · Timeline          88 characters                                                         │
│ Chunk 03 · Roles             31 characters                                                         │
│ Each chunk inherits Members: all members of Startup Club.                                          │
│                                                                    [ Back ]  [ Upload document ]   │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- For an Officers document the first lines read: "Spring 2026 budget will be readable by Treasurer
  and President. Agents that will read it: Funding pre-check and Club handoff, in Treasurer and
  President runs only. Can't read it: Recruiting Q&A and Event planning (outside agent sources)."
- Step 3 closes the Sheet with "Uploaded Pitch night run of show. The demo index is processing it."
  The new row goes Queued, "Indexing 1/3", Ready (K1).
- Text under 40 characters uploads and then shows the Error state, so the error path can be shown
  live.
- Upload errors keep today's copy (`src/lib/documents/upload-error.ts`).

### 7.7 Page data shapes (C modules, no contract change)

```ts
// src/lib/documents/library-page.ts: Documents and Sources
export interface KnowledgeRow {
  id: string; title: string; tier: Tier; sourceId: string; sourceName: string; version: number; createdAt: Date;
  whoCanRead: string;                          // "All members" | "Treasurer, President" | ...
  status: IndexStatus;
  chunkCount: number | null;                   // null until ready
  agents: { readable: number; total: number };
  cited30d: number | null;                     // president or USG admin; null for everyone else
}
export interface SourceRow {
  id: string; name: string; kind: SourceKind; documents: number; chunks: number;
  status: 'ready' | 'indexing' | 'empty' | 'error'; agents: string[]; lastUploadAt: Date | null;
}

// src/lib/documents/document-page.ts
export interface DocumentPage {
  doc: { id: string; title: string; tier: Tier; sourceName: string; version: number; createdAt: Date; uploadedBy: string | null; chars: number };
  status: IndexStatus;
  chunks: DemoChunk[];
  whoCanRead: string[];
  agents: Array<{ installationId: string; name: string; decision: AccessCell; allowedFor: string | null; note: string }>;
  cited: { runs: number; lastAgent: string | null } | null;   // president or USG admin
  canTest: boolean;
}
export async function getDocumentPage(actor: Actor, orgId: string, documentId: string): Promise<DocumentPage | null>; // null = Restricted

// src/lib/documents/retrieval-test.ts
export interface RetrievalTest {
  agent: { installationId: string; name: string; maxTier: Tier };
  subject: { key: string; label: string };
  question: string; topK: number; threshold: number; testedAt: string;
  byPosition: Array<{ key: string; label: string; hits: number }>;
  hits: Array<{ rank: number; score: number; matched: string[]; documentId: string; title: string; tier: Tier; chunk: DemoChunk }>;
  keptOut: Array<{ score: number; matched: string[]; documentId: string; title: string; tier: Tier; chunk: DemoChunk;
                   reason: Exclude<AccessCell, 'allowed'>; path: string; fix: string }>;
}
```

- Reads stay inside `withActor`, with the library scope of decision 16 (`docs/decisions.md:22`).
- Agent lists come from B's `loadAgents`, already used at `src/lib/documents/preview-page.ts:23`.
- A adds `citedCounts(viewer, orgId, days = 30)` in `src/lib/gateway/run-stats.ts`. It answers for
  the club president (club active) and USG admins, and returns `{}` for everyone else.

### 7.8 Mock now, real later

| Element | Tomorrow | Real later | Needs |
|---|---|---|---|
| Answer text | mock reply v2 | WP-13 model call | nothing new |
| Model classes and prices | demo prices; the picked class is validated and billed | provider prices (§17); hold = the class ceiling | price mapping in `LLMProvider`; optionally `RunInspector.modelClass` and `agent_runs.model_class` |
| Credits and usage history | real ledger, shown in credits | same | nothing new |
| Citations | first line of each readable document, a verified substring | WP-14 retrieval with verified quotes | the `[n]` convention and renumbering in the gateway |
| Progressive answer | playback of the finished run | gateway step events and token stream | NDJSON on the runs route, a `RunStep` type |
| Stop | stops the playback | cancels the provider call | `AbortSignal` in the runtime context |
| Memory across runs | not sent; the inspector says so | history loaded and rechecked by the gateway | section 11 |
| Who can read, agents, decisions, kept out | real | real | nothing new |
| Cited counts per document | real (`agent_runs_meta`) | real | nothing new |
| Chunks | demo split of the text | WP-14 chunker; stored chunks copy `read_grants` and get the same policy (§17) | `document_chunks` table and RLS |
| Index status | simulated from upload time | an indexing job | a status column |
| Scores | shared words | vector or hybrid scores | pgvector and an embeddings provider |
| Starters | fixture by template slug | a template-version field | `agent_template_versions.starters` (B) |

## 8. Demo story

The beats in `docs/architecture.md:30-41` stay. The new pages carry the permission story and the
spend story; chat polish is secondary.

| Beat | What the new pages add |
|---|---|
| D2 | Sam picks "Standard only" for Event planning in Administration and gets the clamp message; Event planning's model menu offers Economy only |
| D3 | Lee on the directory: the scope line, "1 credit left today [80% used]", a starter, the model menu (Standard needs 3, so Lee switches to Economy), playback, a citation with "Public: readable by any signed-in student" |
| D4 | Casey's answer is labelled "Uses Members information" and costs "−3 credits · 47 left"; Usage lists the run with its model, club and documents read. In the Retrieval test, the budget chunk is kept out for Member and comes first for Treasurer |
| D5 | Lee's next message: "You've used today's 5 credits for public agents. They reset at midnight PT." Casey's, after Sam sets $0.00: "Your allowance in Startup Club is 0 credits this month. Ask Sam..." |
| D6 | Between Taylor's two runs: "USG Funding Department Guidelines is now v2" |
| D7 | Taylor's next run is refused in place; a later Confirm would be refused too |
| D8 | `tool.call`, `tool.confirm` and `document.upload` join the audit log; Cited counts and Usage match the runs in it |
| New | A pending write action confirmed by a person (I6); an upload whose receipt names who gains access, then indexes live |

Sequence, about eight minutes, with two browser windows (each keeps its own persona cookie):

1. **D1, D2.** Avery syncs the roster and distributes Event planning. In Administration, Sam
   picks "Standard only" for Event planning and is refused, with the cap named.
2. **D3.** Sam publishes Recruiting Q&A. In window 2, Lee opens it from Directory and sees the
   scope line and "1 credit left today [80% used]". Lee picks a starter, opens the model menu,
   tries Standard, sees "Standard needs about 3 credits", switches to Economy and runs. The answer
   plays back; `[1]` opens the quote and its reason; "Economy · −1 credit" and "0 credits left
   today".
3. **D5, Lee half.** Lee asks again and gets the daily block in the transcript. Nothing is
   charged.
4. **D4.** Casey runs Club handoff on Standard ("−3 credits · 47 left") and gets minutes cited,
   "Uses Members information". Casey opens Usage: one run, Standard, Startup Club, 3 documents,
   −3, and the line "Only you can see this list". Talking point: XIPU states that it records every
   chat on its servers; here clubs see metadata only.
5. **D4, president half.** Sam opens Permission preview → Retrieval test and asks "catering
   budget" as Member: three passages, five kept out, led by Spring 2026 budget at 1.00, "Not
   granted". Clicking Treasurer puts the budget chunk first. Then the Access matrix tab, as
   rehearsed.
6. **Knowledge.** Sam uploads "Pitch night run of show". The review step names who gains access
   and which agents will read it. The row indexes live, and the document page shows three chunks
   that inherit Members.
7. **D6.** In window 1, Taylor runs Funding pre-check ("Uses Officers information"). Avery publishes
   the USG Funding Department Guidelines as v2 in `/usg/documents`; Taylor's next run reads
   "USG Funding Department Guidelines (v2)".
8. **Write action.** Taylor sends the "Submit the founder panel request..." starter and confirms
   the pending action.
9. **D7.** Sam moves Treasurer to Jordan. Taylor's next message is blocked by the access check, and
   My agents changes for Taylor and Jordan.
10. **D5, Casey half.** Sam sets Casey's allowance to $0.00 (with the confirm dialog). Casey's next
    message is blocked in place.
11. **D8.** Avery opens the USG audit: metadata only, "Restricted document". Sam's Documents page
    shows Cited counts that match the runs.

## 9. Credits during the demo

| Moment | Balance shown |
|---|---|
| Lee at start | 1 of 5 credits today (four seeded $0.01 runs) |
| Lee after D3 | 0 of 5 today; the next message is blocked |
| Casey after D4 | 47 of 50 this month |
| Startup Club budget after D3 and D4 | 492 of 500 (four seeded runs, Lee's, Casey's) |
| Taylor's runs in D6 and the write action | 489, 486, then 483 of 500 |

## 10. Build plan and cut line

Hours assume the team's recent pace: C shipped the run page (`01f89ef`) and the audit views
(`f1e9a38`) about 75 minutes apart. Each item includes its tests and passes `pnpm check`. B's two
admin pages are already in B's plan (WP-6, WP-7); only the additions are listed.

| # | Item | Owner (paths) | Builder | Hours | Backed by |
|---|---|---|---|---|---|
| 1 | Models and credits in the gateway: prices by class; mock cost and hold by class; `modelClass` in the runs body, validated; credits copy with reset dates; `quotaLine()`, `myUsage()`, `citedCounts()` | A (`src/lib/gateway/**`, `src/lib/runtime/mock.ts`, `src/app/api/agents/**`) | A | 2.5 | real ledger, demo prices |
| 2 | `LoadedAgent.allowedModelClasses`; `submit_to_queue` on `funding-precheck` v1 | B (`src/lib/distribution/**`, `db/seed/distribution.ts`) | B | 0.5 | real |
| 3 | Chat core: composer and keys, model picker, price label, balance chip, low and blocked states, starters, scope line, pre-filled inspector, privacy line, inline notes, Copy, Try again, New conversation, trace | C (`src/components/inspector/**`, `src/lib/documents/run-page.ts`) | C | 3.25 | real + fixtures |
| 4 | Mock reply v2 (Markdown, `[n]`) and the write-action proposal | A (`src/lib/runtime/mock.ts`, `src/lib/gateway/tools.ts`) | A | 0.75 | mock |
| 5 | `ui/markdown`: safe subset, React elements only, `[n]` hook outside code | D (`src/components/ui/**`) | D | 1.0 | — |
| 6 | Answer presentation: playback with Stop, Markdown, inline and row citations with the popover and reason, "Uses … information" label | C | C | 1.5 | mock output, demo pacing |
| 7 | Directory run page on `<RunWorkspace>` with `getRunPageData` | D (`src/app/directory/**`) | D | 0.75 | real |
| 8 | Usage page and nav item | D (`src/app/me/usage/**`, `src/components/shell/navigation.ts`) | D | 1.25 | real |
| 9 | Administration additions: allowances in dollars and credits, "Model for members" column (D2's refusal lives here) | B (`src/app/org/[orgId]/admin/**`) | B | 0.75 | real |
| 10 | Demo index: `demoChunks`, `demoStatus`, `demoScore`, `STARTERS` | C (`src/lib/documents/fixtures.ts`) | C | 1.0 | fixtures |
| 11 | Retrieval test tab, every state | C (`src/app/org/[orgId]/preview/**`, `src/lib/documents/retrieval-test.ts`) | C | 2.0 | real access, demo scores |
| 12 | Documents as the knowledge base (columns, filters, live status) and the upload review Sheet | C (`src/app/org/[orgId]/documents/**`, `src/lib/documents/library-page.ts`) | A, if the team agrees | 2.0 | real + demo index |
| 13 | Document page: Chunks tab, details panel, every state | C (`src/app/org/[orgId]/documents/[documentId]/**`, `src/lib/documents/document-page.ts`) | A, if the team agrees | 1.25 | real + demo index |

**Cut line: after item 13 if the demo stays on the mock runtime.** Pages are the demo's focus,
and this frees A's two WP-13 floor hours (`docs/architecture.md:849-851`).

| | Mock-only demo | WP-13 floor kept |
|---|---|---|
| A | 1, 4, 12, 13: 6.5h | 1, 4, WP-13, then 13 if time is left |
| C | 3, 6, 10, 11: 7.75h | same |
| D | 5, 7, 8: 3h, plus WP-12 | same |
| Cut line | after 13 | after 11; 12 slips; 13 lands only if A finishes early |

- B is fully booked on Administration and the USG pages, which D2, D5, D6 and D7 need. Item 9 is
  the only page work added to B.
- Order inside C: 3, 6, 10, 11.
- Dependencies:
  - item 3 needs 1 (`quotaLine`, prices) and 2 (allowed classes);
  - item 6 needs 4 and 5;
  - items 11–13 need 10.

Below the line, in order:

| Item | Owner | Hours |
|---|---|---|
| Selecting an older run's inspector; Edit message on blocked runs | C | 0.75 |
| Quick look Sheet from citations, quote highlighted | C | 0.5 |
| USG clubs: budgets, allowed models, student daily allowance, prices (U3), with `setClubPolicy` | B | 1.0 |
| Sources tab (K2) | C | 0.75 |
| Text and Access tabs on the document page | C | 1.0 |
| Transcript kept across in-app navigation, plus a History popover | D (provider in `src/app/layout.tsx`), C | 1.0 |
| Scripted demo answers for the starters, used only when the run can read every cited document | A | 1.5 |
| Blocked attempts on Usage, from the viewer's own `quota.blocked` rows | A, D | 0.5 |

Later:
- Run again, and feedback as an audit action;
- "focus on" document chips;
- a collapsible inspector;
- a list column for installation model classes;
- everything in the "Real later" column of section 7.8.

## 11. Contract changes

**Tomorrow.**
- One additive field on the runs route: `POST /api/agents/:installationId/runs` takes
  `{ input: string; modelClass?: 'standard' | 'economy' }`. It goes in a PR labelled `contract`
  and merged by A; `contracts.ts` doesn't change.
- `runAgent(actor, installationId, input, options?: { modelClass?: ModelClass })`. Steps change as
  follows:
  - **Step 1:** load the agent with `allowedModelClasses`. Refuse a class outside the list with
    `clamp_violation` and `authz.denied` (reason `model_class`). Otherwise run
    `{ ...agent, modelClass }`.
  - **Step 4:** hold the class price.
  - **Step 6:** the runtime reports cost and model by class.
- Docs to update in the same PR:
  - §7: the mock line, prices and the request field;
  - §8: the clamps row ("null model class means members choose within the template and USG
    lists");
  - §11: the credits copy table;
  - §14: three page rows (`/org/[orgId]/documents/[documentId]`,
    `/org/[orgId]/preview/retrieval`, `/me/usage`).

**Later: memory across runs**, the smallest change that keeps it possible:

```ts
// src/lib/contracts.ts
/** An earlier run of the same conversation, as the runtime sees it. reply is null when the gateway
 *  withheld it: a document that run was given is not readable by this run. */
export interface ConversationTurn { input: string; reply: string | null }

export interface AgentRuntime {
  run(agent: EffectiveAgent, actor: Actor, input: string, ctx: {
    runId: string;
    accessibleDocuments: AccessibleDocument[];
    history: ConversationTurn[];          // oldest first; [] for a first message
  }): Promise<AgentResult>;
}

export interface RunInspector {
  // ...existing fields
  history: { sent: number; withheld: number };
}

// POST /api/agents/:installationId/runs   body adds previousRunIds?: string[]  (at most 6 uuids)
```

- Steps 1–3 run on every message, so grants are recomputed each time.
- New step 3a loads `agent_runs` by `previousRunIds` inside `withActor`. `runs_own` returns only
  the actor's rows; the step keeps those of this installation with status `completed`, ordered by
  `started_at`. If any id is missing, it returns 404 `not_found`.
- After step 5, a history reply is withheld unless its `accessible_document_ids` are all still in
  this run's accessible set. That is how a position transfer reaches the agent's memory.
- `run.access` details gain `historyRunIds` and `historyWithheld` (ids and numbers, I8).
- The real runtime's per-message hold covers history, which is trimmed (`TODO(verify):` 12,000
  characters).
- No schema change. A server-side conversation list later needs `agent_runs.conversation_id`.
  XIPU's "Context Count" becomes a setting in the model menu.
- Real citations use `[n]` for `citations[n - 1]`. Step 8 drops a citation whose quote isn't a
  substring of its document, and renumbers the markers that remain.

## 12. Research: adopted and departures

Adopted:
- **Demo:** lead with the permission story; add the I15 contrast with XIPU's "all chat records ...
  recorded".
- **Chat:**
  - Enter, Shift+Enter and the IME guard;
  - starters that fill the composer instead of sending;
  - the privacy line;
  - numbered source chips, each with a tier chip, a reason and a link to its inspector row;
  - the "highest tier read" label (the Microsoft 365 Copilot pattern);
  - Copy, and Try again only on network and server errors;
  - the finished-run trace; the scope line with a pre-filled inspector.
- **Models and credits:**
  - the model control in the composer row;
  - a cost label before sending (Poe);
  - a balance chip with its reset date and the "80% used" chip;
  - a blocked banner on page load that names who can raise the limit;
  - hold → settle described as Poe's reserve-then-charge;
  - a usage table with Time, Agent, Model, Club billed, Documents read and Cost, newest first, a
    monthly total and no question text.
- **Knowledge:**
  - the Who can read, Agents and Cited columns, with Cited from `agent_runs_meta`;
  - the upload access receipt;
  - a Retrieval test run as a position, listing what permissions kept out;
  - Dify's names: chunks, Top K, Score threshold, Retrieval test.

Departures:
- **An interactive model picker, not a read-only chip.**
  - The research held that per-run choice widens the installation (I7). Reading a null installation
    model class as "members choose within the template's and USG's classes", and a set one as
    fixed, keeps every run inside what the template and USG allow and leaves the club in control.
  - The only server change is the request field.
- **Credits instead of dollars for students.** The research kept dollars. Students know 积分 from
  campus platforms, and dollars stay on budget holders' pages and in tooltips, where USG allocates them.
- **Inline `[n]` markers ship tomorrow.** Mock reply v2 places them, a change in A's own file.
- **Playback instead of no streaming.** It narrates only steps the finished run took, and Stop says
  the run already finished.
- **"Runs stand alone" goes in the inspector**, as the History row, not under the composer.
- **The Retrieval test, index status and chunks ship tomorrow** on the labelled demo index, because
  these pages run on fixture data by design. Their permission filter is real.
- **No chunk-level retrieval counts.** Fake usage numbers would contradict the audit log on stage.
- **The directory page is a P0 item.** It doesn't reuse `<RunWorkspace>` today
  (`src/app/directory/[installationId]/page.tsx:35-37`).
- **`quotaLine()` instead of `remaining()`.** The balance needs the binding level, its scope and its
  reset date.
- **A document page as well as the Sheet.** Chunks with their tier need a full page; the Sheet
  becomes the P1 quick look.

## 13. Decisions to record and checks

Decisions to add to `docs/decisions.md`:
- Chat and knowledge pages run on the mock runtime and a labelled demo index (chunks, statuses and
  scores from document text). Their access decisions are the real RLS and `explainAccess` checks,
  and the demo index is never read by a run.
- Students see credits (1 credit = $0.01 of the billed club's budget). Presidents and USG see
  dollars with credits beside them. Quota stays in micro-USD.
- A null installation model class means members choose a class per message within the template's
  and USG's lists; a set class is fixed. The gateway validates the class on every run and bills its
  price.
- On the demo runtime, answers play back progressively and narrate only the finished run's real
  steps. Real streaming replaces the playback after WP-13.
- If agreed: A builds items 12 and 13 in C's paths, and C reviews and owns them.

`TODO(verify):`
- The demo prices (Economy 1 credit, Standard 3) against A's gateway tests: the tests that assume a
  flat $0.01 hold, and the D-beat runbook's "$0.01" for Standard agents
  (`docs/streams/d-integration.md:73-84`).
- `demoStatus` treats seeded ids as ready. Seeded rows are created at `DEMO_NOW`
  (`db/seed/documents.ts:28`), so the first seconds after a restart would otherwise show them
  indexing.
- `grantLabels` labels both `<org>:*` and `<org>:member` "Startup Club · Member"
  (`src/lib/authz/index.ts:135-141`); deduplicate in the scope line and trace.
- The president's name in "Ask Sam" copy. Memberships have no RLS, so the gateway and pages can
  read it, but confirm that the team wants names on the page.
- How `setClubPolicy` treats installations fixed to a class that USG removes: reset them, or refuse
  and name them.
- Hover-opening Radix popovers on citation chips; keep focus and click as the main triggers.
- Inline citation chips must be buttons, not links. `tests/run-page-render.test.ts:90-95` asserts
  that no document id appears in the transcript HTML.
- Adding a tool to `funding-precheck` v1: check B's distribution tests and the catalog's display of
  tools.
