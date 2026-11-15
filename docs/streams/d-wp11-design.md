# WP-11 student pages

The authoritative design is `.claude/agents/ui-designer.md`, backed by the existing WP-2
tokens, shell and primitives. This slice adds three routes inside that shell. It introduces
no dependencies or global styles. The project requires light mode, desktop-first layouts,
36px controls, dense rows and local table scrolling.

## Screen briefs

- Directory: find a public agent and Open it. Priorities: agent job, publishing club, access.
  Required content: name, purpose, club, All students audience, Open, search, club and purpose
  filters, result count, Clear filters, loading, empty, sign-in and retry states.
- My agents: Open an agent offered by one of my clubs. Priorities: club and my positions,
  agent job, audience reason and version. Required content: one section per returned club,
  position names, name, purpose, reasonLabel, template version, Open, loading, empty, sign-in,
  session-switch pending and retry states. Open must await A's confirmed active-org change
  before navigating to C's run route.
- Public run: submit a question to the selected public agent. Priorities: question/answer,
  audience and publishing club, inspector. Required content: title, purpose, All students,
  template version, question label, Run agent, pending status, error/quota copy, document-style
  transcript, AI-generated sources disclosure, Mock label when runtime is mock, imported
  Inspector after success, and links back to the directory. No input or output is persisted
  in client storage or a URL.

Layout: Directory - compare agent jobs -> stack + table (project UI designer, Lists and
directories); scroll owner: document vertically, table container horizontally; anti-patterns:
card grids and document-wide horizontal overflow.

Layout: My agents - compare within club context -> stack of sections + tables (project UI
designer, My agents); scroll owner: document vertically, table containers horizontally;
anti-patterns: mixing clubs and navigating before session confirmation.

Layout: Public run - read answer with access evidence -> sidebar, transcript max 720px and
inspector 384px (project UI designer, Agent run page); scroll owner: document; anti-patterns:
chat bubbles, nested vertical scrollers and a fixed-width inspector forcing page overflow.
The columns stack when the content region is too narrow.

The shell and all new controls reuse the existing Button, Input, Textarea, Label, Badge,
Alert, Skeleton and Table primitives already exercised in WP-2/WP-10. Loading, disabled,
focus, pending and error states use those tokens. No decorative cards, counters, avatars,
marketing copy or additional React tooling are added; dependencies and shell ownership are
outside this WP-11 slice.

## Integration choices

Read models come directly from B's published `directory()` and `myAgents(userId)` exports.
D does not recompute audiences, membership grants or listing eligibility. The directory
detail resolves the selected installation from `directory()` rather than exposing private
effective-agent configuration to the client.

A's frozen run API route is absent in this checkout. A page-local Server Action calls the
published `gateway.runAgent` with fresh `getActor()` on each submission, validates form input,
and checks current public-directory eligibility again. It refuses a stale persona binding.
It adds no API route or contract. The action returns only the submitting user's result.
C's `Inspector` is imported intact; its internals and access decisions remain C's responsibility.

## Verification ledger

Verify actual Next.js pages with real persona/session endpoints and PostgreSQL memberships.
Label B listing/document fixtures, C Inspector stub, A missing persistence/quota and arranged
publish/error/loading states explicitly. Exercise Casey, Taylor, Morgan and Lee; filters;
session-switch rejection and success; public runs, anonymous/stale/nonpublic submissions;
keyboard, text spacing, 320/390/1440/1920px reflow; and run source disclosure. Record findings,
captures and owner blockers in `d-wp11-verification.md`.

## Findings closed during QA

- Club and Purpose select triggers now have explicit accessible names, so their names remain
  stable when a selected value changes.
- The visually hidden Actions heading in each list table needs a positioned table-header cell.
  Without it, its absolute positioning can escape the table's horizontal scroll container and
  expand the mobile document to 586-594px. Both cells use `relative`. Fresh live and arranged
  checks assert the requested viewport width against both `innerWidth` and document scroll width;
  320px and 390px now remain at scale 1 with local table scrolling.
- Mock answers retain their explicit placeholder label. Quota/network failure states retain the
  question, and pending runs keep button dimensions stable and exclude duplicate submissions.
