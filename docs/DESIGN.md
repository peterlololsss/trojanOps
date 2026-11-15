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
message surfaces; AI answers align left under an explicit AI label. A bounded 720px chat window
owns transcript scrolling, with its composer fixed below the scroll area. A 384px inspector with
its own overflow sits across a 24px gap. Document detail uses a sticky aside. Columns stack on
narrow screens. Wide
tables own horizontal scrolling. Retrieval uses a 360px form beside fluid results and stacks
when narrow. The application shell and disclaimer remain in document flow.

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
