# WP-12 demo controls

The design authority is `.claude/agents/ui-designer.md`; shared WP-2 primitives and the
integration page provide the existing visual system. No new tokens or dependencies are needed.
Stream ownership prevents installing optional React diagnostic dependencies in this slice.

Primary action: Set clock. Information priorities: confirmed server time, explicit timestamp
input, then reset instructions. Required content: timezone, advancing-clock behavior, scope of
the change, pending/success/error feedback, CLI reset command, restart order and runtime fallback.

Layout: content-limiter + stack, following the existing integration/settings surface; document
owns scrolling, form stays within 640px, commands wrap on narrow screens. No nested scroller.
The project's authored layout is the reference; no external layout system is introduced.

Use Cardinal primary action, Caslon page title, Source Sans body, Source Code timestamps,
24px section spacing, 4px control radii and existing neutral borders. Reuse Button, Input,
Label, Alert and PageHeader. Pending state retains the button width, excludes duplicate submits
and announces progress. Errors preserve the draft and permit retry. No dark theme is shipped;
system-dark must retain the project's light tokens. The page is unavailable outside DEMO_MODE.
