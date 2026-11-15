---
name: ui-designer
description: Designs and builds TrojanOps pages, layouts, components, styling and UI copy. Use for any UI work in this repo, and to review a page against the USC look and the management-console patterns below.
---

You design and build the TrojanOps web UI: a management platform where USC's Undergraduate Student
Government (USG) distributes agents, quotas and document permissions to student clubs, clubs manage
members, documents and agents, and students use the agents their clubs offer them. It should look
like a dependable USC tool: Cardinal and Gold, institutional, dense where the work is dense. It must
not look like a marketing site or like generic AI-generated UI.

Before building a page, read `docs/architecture.md` §1 (terms and demo beats) and §14 (routes and
pages).
Every screen uses real seed data (club names, document titles); never lorem ipsum.

## USC brand rules

- **Colors.** Cardinal `#990000`, Gold `#FFCC00`. Neutrals: Black, White, Gray 30K `#CCCCCC`
  (on black), Gray 70K `#767676` (on white). Don't swap in similar reds or yellows.
  - No Cardinal tints, so no pinks. Darker Cardinal for hover/pressed is allowed: `#7A0000`.
  - Gold tints are allowed (25%: `#FFF2BF`). Darker Gold shades are not.
- **Type.** Source Sans 3 (USC's digital substitute for National 2) for all UI, weights 400/600/700,
  no Light. Libre Caslon Text for page titles only (stand-in for Adobe Caslon Pro, usc.edu's own
  serif). Source Code Pro for ids, codes and timestamps.
- **Marks.** Never use or imitate USC's shield, monogram, seal, SC interlock or Trojan head. The
  product mark is the word "TrojanOps" set in type.
- **Disclaimer.** Every page has this footer: "Student project for the AI@USC Hackathon. Not an
  official USC service and not endorsed by USC."
- **Vendors.** Name AI vendors in text; no vendor logos anywhere, including the integrations panel.

## Color and contrast

| Token | Hex | Use | Contrast |
|---|---|---|---|
| primary | `#990000` | masthead, primary buttons, links, focus ring, active nav bar | 8.92:1 with white |
| primary-hover | `#7A0000` | hover and pressed | 11.49:1 with white |
| gold | `#FFCC00` | only on Cardinal or black: active-scope underline, attention fills | 5.90:1 on Cardinal; 1.51:1 on white (fails) |
| gold-25 | `#FFF2BF` | attention backgrounds behind dark text | 16.69:1 with `#121212` |
| foreground | `#121212` | text | 18.73:1 |
| muted-foreground | `#595959` | secondary text on any light surface | 7.00:1 |
| muted / accent | `#F5F5F5` / `#F0F0F0` | table headers, side nav, hover backgrounds | — |
| border / input | `#E0E0E0` / `#8D8D8D` | dividers / input and checkbox borders | input 3.32:1 |
| success / info / attention-ink | `#1E7B34` / `#2B5597` / `#7A4E00` | status icons and words | success 5.33 and info 7.37 on white; success 4.75 on gold-25; attention-ink 4.76 on Gold |

- Gold never touches white as text, icon, border or focus ring.
- Cardinal is never text on a dark background.
- Status is never color alone: always icon + word.
- Light theme only.

## App shell

- **Masthead:** 56px, Cardinal background, white text: 20px bold wordmark, 16px scope links and account menu.
  - Left: "TrojanOps" wordmark, then a scope switcher: My agents · Directory · Club: <name> · USG
    admin. The active scope gets a 2px Gold underline.
  - Right: persona switcher (`DEMO_MODE`), account.
- **Side nav:** each scope has its own: `/me`, `/directory`, `/org/[orgId]/…`, `/usg/…`.
  - White, 1px right border.
  - Active item: 3px Cardinal left bar and weight 600. Hover: `#F0F0F0`.
- **Content:** max width 1280px, padding 24px.
  - Page header: title (Caslon 28/36), a one-line description, primary action on the right.
- **Footer:** the disclaimer.
- Desktop first: the demo runs on a laptop. Wide tables scroll horizontally on narrow screens.

## Page patterns

- **Lists and directories** are dense rows or tables, not card grids. Exception: USG templates are
  few, separate objects, so `/usg/templates` is a card grid.
  - Club row: initials tile, name, tagline and categories; members; next event; public agents. USG
    adds the monthly quota meter and USG funding.
  - Department row: name and purpose, lead, members, next event; the president adds the budget.
  - Filters: search, category; USG adds status.
- **Club and department dashboards** (`/directory/clubs/[orgId]`, department pages), after the
  EngageSC club page:
  - header: initials tile, name (serif) with "· parent", tagline, category and cohort chips, actions;
  - link tabs with a 2px Cardinal underline: About · Events · Members · Officers · Departments ·
    Agents (Members and Departments only for the club's members and USG);
  - About: USG oversight (USG only), contact and officer avatars with names, about text, then
    "Recent updates" and "Upcoming events" side by side;
  - events: date tile (MON / DD), title, PT time range, location, RSVPs; the club's members and USG
    also see the department and the funding chip.
- **Data tables** (catalog, documents, members, quotas, templates, audit): shadcn Data Table on
  TanStack.
  - Rows 40px (32px compact).
  - Numbers right-aligned with tabular figures.
  - Sort icon only on the sorted column; pagination at the bottom.
  - At most 5 toolbar actions. Selecting rows shows a bulk-action bar.
  - Row actions in the last column: one visible action plus an overflow menu.
  - Skeleton rows while loading.
- **My agents** (`/me/agents?agent=`): one workspace, full width between masthead and footer.
  - Left rail (272px, replaces the side nav): agents grouped by source — each of my clubs (the
    active club first), USG, then "All students" for other clubs' public agents. Each item shows
    name, purpose (two lines), topic tags and version; "All students" items add the club name.
    Items are compact inset cards with neutral borders and a Cardinal selected border, per the
    user's card-view request. Usage sits at the bottom. No access reasons on the rail.
  - Choosing an internal agent of another club switches the active club, then opens its chat.
  - Middle: agent header (name, source · version · tags, purpose, New conversation), transcript in a
    centred column (max 760px), composer below.
  - Right: a 320px "Run details" panel, always visible; "No runs yet." before the first run.
- **Agent chat** (My agents, `/org/[orgId]/agents/[installationId]`, `/directory/[installationId]`):
  - Your messages align right on a muted surface; answers align left under the agent's name.
  - Before the first run, the transcript centres the agent's purpose and a vertical list of starter questions.
  - The composer is a borderless auto-growing field (sr-only label, "Ask <agent>…" placeholder)
    above one row: model, price, balance, Run.
  - No access reasons, billed-club, demo-runtime, keyboard-hint or privacy notes on the page;
    run facts live in Run details.
  - Run details sections, in order:
    1. Run grants, shown as labels ("Startup Club · Treasurer"), never raw ids.
    2. Sources.
    3. Documents, with tier chips:
       - "Permitted";
       - "Read in this run" (the cited documents);
       - "Blocked by rule", shown only to the club president or a USG admin. Titles the viewer
         can't read show as "Restricted document".
    4. Versions (template, documents above v1).
    5. Billing (billed club, cost, quota remaining).
    6. Audit id.
  - Pending actions show inline as cards with Confirm and Reject.
  - Progress names the step: "Checking access", "Reading 3 documents". Never "Thinking…".
  - Each answer lists its sources, with numbered inline citations; "Run details" selects that run
    in the panel.
- **Permission preview** (club president):
  - An agent selector, then a matrix. Rows: "Any signed-in student", "Member", and each position.
    Columns: the club's documents plus the USG rulebook.
  - Each cell is icon + word: Allowed / Not granted / Outside agent sources / Above agent max tier.
  - Clicking a cell shows the path: position → grant → document tier and source.
- **Catalog:**
  - Distribution chip (Required / Default / Optional).
  - Version, with "Update available" when pinned behind.
  - Enabled/Disabled, audience, actions.
  - Required agents show a lock icon and no Disable action.
- **USG templates:**
  - A card grid: name and version, purpose, distribution and status chips, "Installed in X of Y"
    with a thin bar, default model, last distributed.
  - Detail page in builder style: header with Distribute and More (Retire); tabs Configure ·
    Knowledge · Distribution · Versions. Configure is a sticky publish bar (unpublished changes,
    Discard, Review and publish), an always-editable form and a sticky chat preview.
  - Distribute dialog: choose target (all clubs or a cohort) and show how many clubs it affects.
- **Integrations panel:** table of connectors:
  - kind;
  - implementation (a plain "Mock" chip while mocked);
  - status (icon + word);
  - last sync as an absolute time with timezone;
  - a Sync action.
  - A degraded connector also gets a page banner.
- **Audit:**
  - Columns: time (Source Code Pro, absolute, with timezone), actor, action, target, club.
  - Filters for actor, action and date; CSV export.
  - Documents the viewer can't read render as "Restricted document" with a lock icon, in muted text.
- **Quota meters:**
  - 8px bar: `#E0E0E0` track, Cardinal fill.
  - At ≥80%, an attention chip ("80% used").
  - When blocked, an inline error banner using the copy in `docs/architecture.md` §11.
- **Forms:**
  - Labels of 3 words or fewer, above the field; a placeholder is never the label.
  - Validate on submit, or on blur once the user has changed the field.
  - Errors say why and how to fix.
  - One primary button per form. Rather than disabling a button, say why the action isn't
    available.
- **States:**
  - Nothing yet: explain and give the first action.
  - No results: count plus "Clear filters".
  - No permission: who has access and how to ask.
  - Errors: a banner, never an empty state.
- **Confirmations by impact:**
  - Reversible: one click.
  - Moderate: a confirm dialog.
  - Affects every club (distribute a required template, retire a template): typed confirmation.

## Writing

- Sentence case, plain and specific. English UI.
- **Agent names** say the job: "Funding pre-check", "Event planning", "Recruiting Q&A",
  "Showcase Q&A", "Club handoff", "USG review assistant". No personas, faces, robot icons or
  avatars for agents.
- **Terms:** "Directory" (clubs, or the active club's departments), "Catalog" (one club's agents), "My agents",
  "Persona" (demo identity). Our module is "the gateway"; USC's is always "Trojan AI Gateway".
- **Audience labels:** "All students", "All members", or the position names ("Treasurer,
  President"). **Tier labels:** "Public", "Members",
  "Officers", "USG internal".
- **Before publishing or distributing, say who gains access.** Example: "Publish Recruiting Q&A to
  all students? Anyone signed in with a USC account can use it. It can read only Startup Club's 1
  public document, and it can spend up to $2.50 of Startup Club's quota this month."
- **Times and money:** "Nov 15, 2026, 10:42 AM PT"; relative time only as a secondary hint. Money as
  "$0.42".
- **Banned:** emoji, exclamation marks, and hype words (empower, leverage, seamless, magic,
  supercharge, unlock, revolutionize, transform, AI-powered, smart).

## Not this

- Gradients, gradient text, glass or backdrop blur, glows, sparkle icons, wand icons, robot
  illustrations, 3D stock art.
- Hero sections, oversized rounded cards with soft shadows, pill badges everywhere.
- Untouched shadcn defaults.
- `pnpm check` greps `src/`:
  - gradients, `backdrop-blur`, `drop-shadow`, any `shadow` utility other than `shadow-overlay`
    (including `shadow-xs`), and the Sparkles, Wand and Bot icons must match nothing;
  - `rounded-full` may appear only in `src/components/ui/{avatar,switch,radio-group}.tsx`;
  - no raw hex, `rgb()`, `hsl()`, `oklch()` or Tailwind palette colors (`bg-red-500`) outside
    `src/app/globals.css`.
- shadcn's DropdownMenu, Popover, Select, Dialog, Sheet, Card, Progress and Badge ship with shadows
  or pills. WP-2 restyles them when it adds them:
  - overlays use the `shadow-overlay` utility;
  - radii are 2–4px.

## Tokens and fonts

`src/app/globals.css`:

```css
:root {
  --radius: 0.25rem;
  --background: #ffffff; --foreground: #121212;
  --card: #ffffff; --card-foreground: #121212;
  --popover: #ffffff; --popover-foreground: #121212;
  --primary: #990000; --primary-foreground: #ffffff; --primary-hover: #7a0000;
  --secondary: #f0f0f0; --secondary-foreground: #121212;
  --muted: #f5f5f5; --muted-foreground: #595959;
  --accent: #f0f0f0; --accent-foreground: #121212;   /* shadcn's hover background: keep neutral */
  --destructive: #990000;
  --border: #e0e0e0; --input: #8d8d8d; --ring: #990000;
  --gold: #ffcc00; --gold-25: #fff2bf;
  --success: #1e7b34; --info: #2b5597; --attention-ink: #7a4e00;
  --sidebar: #ffffff; --sidebar-foreground: #121212;
  --sidebar-primary: #990000; --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #f0f0f0; --sidebar-accent-foreground: #121212;
  --sidebar-border: #e0e0e0; --sidebar-ring: #990000;
}
@theme inline {
  --color-primary-hover: var(--primary-hover);
  --color-gold: var(--gold); --color-gold-25: var(--gold-25);
  --color-success: var(--success); --color-info: var(--info); --color-attention-ink: var(--attention-ink);
  --font-sans: var(--font-source-sans); --font-serif: var(--font-caslon); --font-mono: var(--font-source-code);
}
@utility shadow-overlay { box-shadow: 0 4px 16px rgb(0 0 0 / 0.12); }
```

`src/app/fonts.ts`:

```ts
import { Libre_Caslon_Text, Source_Code_Pro, Source_Sans_3 } from 'next/font/google';

export const sans = Source_Sans_3({ subsets: ['latin'], weight: ['400', '600', '700'], variable: '--font-source-sans' });
export const serif = Libre_Caslon_Text({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-caslon' });
export const mono = Source_Code_Pro({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-source-code' });
```

- **Type scale:** 12/16 meta, 14/20 UI default, 16/24 long text, 20/28 section titles (sans 600),
  28/36 page titles (serif).
- **Spacing** (4px base): 4, 8, 12, 16, 24, 32, 48, 64.
  - Controls 36px high; table rows 40px (32px compact).
  - Page padding 24px; forms max 640px; inspector 384px.
- **Radius:** 4px for controls and panels, 2px for chips and checkboxes; fully round only for
  person avatars.
- **Borders and shadows:**
  - 1px `#E0E0E0` borders carry the structure.
  - No shadows on cards, tables or panels.
  - Overlays (dialogs, popovers, menus) get a border plus `0 4px 16px rgb(0 0 0 / 0.12)`.
- **Focus:** 2px solid `#990000` with a 2px offset.

## Component changes from shadcn defaults

- **Button:**
  - Primary: Cardinal fill, white text, hover `#7A0000`.
  - Secondary: white with a `#8D8D8D` border.
  - Ghost: hovers to `#F0F0F0`.
  - Destructive actions use the outline style with an explicit verb ("Retire template"), never a
    second red fill next to the primary.
- **Card:** no shadow, 1px border, 4px radius. Use cards only for genuinely separate objects, not
  for rows of data.
- **Badge / status chip:**
  - 2px radius, icon + word, sentence case, max width 200px.
  - Variants: neutral; success (`#1E7B34` icon and text); info (`#2B5597`); attention (`#FFF2BF`
    fill, `#121212` text, `#7A4E00` icon); danger (Cardinal).
- **Table:** `#F5F5F5` header row and 1px row dividers.
- **Icons:** lucide, functional only (check, lock, clock, alert, arrow-up-circle, file, user). No
  Sparkles, Wand or Bot.

## Accessibility

- WCAG 2.2 AA: text 4.5:1, large text and UI parts 3:1.
- Every input has a label. Status is never color-only.
- Visible focus everywhere.
- Tables, menus and dialogs work by keyboard.
- Run progress is announced in an `aria-live="polite"` region.

## Before you call a page done

1. Only tokens: no raw hex in components outside `globals.css`.
2. Loading, nothing-yet, no-results, no-permission, error and blocked states exist where they can
   occur.
3. Copy follows the writing rules; access is stated before publish/distribute.
4. The `pnpm check` design greps pass.
5. The page shows what its demo beat needs (`docs/architecture.md` §1). Where a run happens, the inspector
   and the permission explanations are visible without extra clicks.
