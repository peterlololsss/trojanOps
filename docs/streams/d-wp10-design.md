# WP-10 integration panel

The design source is `.claude/agents/ui-designer.md`, using the existing WP-2 shell and UI
primitives. Avery, the USG administrator, reviews the five connector implementations and
syncs the fictional roster. Other users receive a permission explanation.

Primary action: Sync roster, in the roster row. Information priorities: connector health,
implementation and last successful sync, then the changes returned by the sync.

Required content: five connector kinds, implementation names, Mock chips, icon-and-word
status, absolute timestamps in America/Los_Angeles, sync progress and retryable errors,
per-club position changes and installed-agent counts. A zero installation count stays zero;
the screen does not assert that a template was installed without a service result.

Layout: integration panel - compare five connector records -> stack with a horizontally
scrollable semantic table (skipped: StyleGallery host unreachable through local curl TLS);
scroll owner: document vertically, shared Table container horizontally; anti-patterns:
nested vertical scroll areas, clipped table cells, reordered keyboard navigation.

Use the existing light-only Cardinal/Gold tokens, Caslon page title and Source Sans 3 UI.
No decorative cards, summary tiles, vendor marks, new dependencies or root configuration
changes. Sorting, filtering and pagination are unnecessary for five fixed connector kinds.

States to verify: signed-out and non-admin access, initial five rows, loading, successful
first sync, repeated zero-change sync, pending exclusion, failed request and retry,
degraded/down connector banner, server error boundary and narrow-screen table overflow.
Roster mutations may commit before provisioning fails; errors instruct the user to retry
without claiming that the whole operation rolled back.

Browser and accessibility verification is recorded with the WP-10 verification evidence.
