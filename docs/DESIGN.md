# TrojanOps page implementation

The authoritative visual rules are `.claude/agents/ui-designer.md`; target content and states are
in `docs/chat-knowledge-design.md`. This is a light-theme management console with fictional seed data.

The user's final scope is desktop only: acceptance uses 1440 and 1920px viewports. Earlier phone
captures are exploratory evidence and are excluded from the final verdict.

## Tokens

Use the existing `globals.css` color tokens: background, foreground, primary, primary-hover,
muted, muted-foreground, border, input, success, info, gold-25 and attention-ink.
Source Sans 3 is body type; Libre Caslon Text is reserved for page titles; Source Code Pro is for
timestamps and identifiers. Body is 14/20, prose 16/24, metadata 12/16, section headings 20/28,
page titles 28/36. Spacing uses 4, 8, 12, 16, 24 and 32px. Controls are 36px; panels have 4px radii.
Borders carry structure; only overlays have shadow-overlay. All controls have visible focus.

## Layout

Layout: the chat follows the user's Dify-style override: user messages align right in neutral
message surfaces; AI answers align left under the agent's name. My agents is one workspace: a
272px agent rail grouped by source, the chat (a centred transcript column up to 760px that owns
its scrolling, composer fixed below) and a 320px Run details panel with its own overflow. Other
run pages show the same chat and panel without the rail. Document detail uses a sticky aside. Columns stack on
narrow screens. Wide
tables own horizontal scrolling. Retrieval uses a 360px form beside fluid results and stacks
when narrow. The application shell and disclaimer remain in document flow.

My agents starts with a titled rail and compact inset agent cards, following the user's card-view
request. Cards use 4px corners, neutral borders and a Cardinal border on the selected item.
Source headings are 12/16,
agent names 14/20 semibold, purposes 12/16 and limited to two lines. The active row uses the
Cardinal selection treatment. The chat header carries name, source and version;
topics stay in the rail. Before a run, the transcript region centres the current purpose and
a vertical list of starter questions. Once a message is sent, the transcript starts at the top.
The composer groups model and price on the left, with allowance and Run on the right, wrapping
within its own width. Run details stays visible and explains its contents before the first run.

## Screens and priorities

| Screen | Primary action | Information priorities |
|---|---|---|
| Chat | Run | Scope and permitted sources; model price and balance; answer with citations |
| Usage | Open My agents when empty | Remaining allowances; monthly spend; private run metadata |
| Documents | Upload document, president only | Readable documents; access and index status; agent and citation counts |
| Document | Test retrieval, president only | Inherited chunk permissions; exact text; details and readable agents |
| Retrieval | Test retrieval | Agent and position; permitted hits; real reasons for kept-out chunks |
| Administration | Existing save/transfer actions | Budget in dollars and credits; member allowances; bounded model options |

## Reusable components and states

Reuse Button, Badge, Progress, Table, DropdownMenu, Popover, Sheet, Alert and Skeleton.
Markdown emits React elements and accepts citation buttons outside code. Composer and answer
components share prices from the gateway. Model controls offer bounded radio choices.
Status chips include words and icons. Upload uses Details, Review access and Index steps.
Every data page includes loading, empty, error and permission states; filters have no-results
and clear-filter states. Chat includes low balance, blocked, pending, playback and stopped states.
Respect reduced motion. No browser storage holds questions or answers.

## Required behavior and content

Agent runs show a rotating progress icon and a pulsing track while the request checks access and
quota. The existing word-by-word playback presents the completed answer, alongside checked
access and document counts and a rotating playback indicator. Motion uses the existing Tailwind
spin and pulse primitives, runs only while the corresponding operation is active and becomes
static under reduced motion. Completed answers retain their source citations. Demo prompts,
status labels and answers are English-only. The loader catalog was unreachable during this edit.

Preserve every control and state in design sections 5–7: IME-safe keyboard submission, starters
that fill without sending, safe Markdown, numbered citation buttons, quotes and access reasons,
real credits and resets, finished-run trace, human confirmation, metadata-only Usage, live demo
index status, retrieval Top K and Score threshold, inherited chunk tiers and upload access review.

## Verification ledger

Baseline: PostgreSQL 17.12 on an isolated loopback cluster; all 540 original tests passed.
Capture chat before changes, then C1–C6, Usage, Documents, Document, Retrieval and Administration
at desktop and narrow widths. Verify keyboard operation, reflow, live feedback and privacy.
The gap to close is missing cost visibility, chat controls and knowledge views; decorative
metrics, marketing cards and a conversation sidebar are outside the brief.

The composer uses a compact demo-model menu displaying official API IDs, verified 2026-11-15:
`gpt-6-luna`, `gpt-6.1-sol`, `claude-haiku-5-5`, `claude-sonnet-5-5`,
`gemini-4-hydrogen`, and `gemini-4-carbon`.
These map to the gateway's existing Economy/Standard demo pricing classes
and remain filtered by the template and club policy. The menu explicitly identifies the mock
runtime. Selection is local UI state, not a configured external provider. Reset dates live in
the allowance popover, keeping the closed toolbar compact.

## Template administration

Template detail uses four local Radix tabs on its existing route, Configuration, Knowledge base,
Distribution and Version history. Tabs have a Cardinal underline, keyboard arrow navigation and
visible focus. Mounted hidden panels retain drafts when switching tabs. Knowledge base uses a
190px connected-source rail beside a searchable document table. USG sources show authorized
document metadata and link to existing document detail for version management. Club sources show
their ownership and point administrators to each club's library. Empty sources and no search
results have distinct messages. Adding a public rulebook document requires reviewing its shared
source and public audience in the upload dialog. Source changes publish an immutable template
version through the configuration editor. Retired templates retain read-only knowledge views.

Models share the chat's demo model catalog and gateway prices, grouped by pricing class. The
saved default applies to a class. Distribution has one persisted target control and one rollout
trigger. Rollout reviews the saved target, affected clubs and audience. Unsaved settings must be
saved before rollout. Retirement sits beneath the distribution form as an outline action.

The knowledge layout follows Dify's connected-knowledge and document-list interaction patterns,
using TrojanOps typography, tokens and permissions.
