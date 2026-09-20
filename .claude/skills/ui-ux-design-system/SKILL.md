---
name: ui-ux-design-system
description: The visual design system, layout conventions, and shared component library for this attendance/payroll app (dark+light theming, RTL/i18n, sidebar, pickers, tables, dashboard patterns). Use this whenever building a new page, redesigning an existing one, adding a UI component, or touching anything visual/layout-related in this project — new forms, new tables, new stat cards, new charts, empty/loading states, or any request like "make this look better", "add a page for X", "match the existing style", or "improve the UI/UX". Following this keeps new work indistinguishable from what's already here instead of introducing a one-off look.
---

# UI/UX design system (Attendance Checkpoint)

This app went through a full design pass (dark/light themes, RTL + 3 languages,
custom pickers, a dashboard rework) that established a consistent visual language.
This skill captures that language so new work matches it instead of drifting into
a different style. Read it before adding or redesigning any page, and re-check it
if a change feels like it's introducing a new pattern rather than reusing one.

## Design tokens (`frontend/src/index.css`)

Everything is driven by CSS custom properties on `:root`, overridden under
`:root[data-theme="light"]` and mirrored under `@media (prefers-color-scheme: light)`.
**Never hardcode a color** — always reference the variable, so both themes stay correct
automatically:

- Surfaces: `--bg`, `--bg2`, `--bg3`, `--bg-hover`, `--border`
- Text: `--text`, `--muted`
- Brand: `--accent` (ZKTeco green — a darker shade in light theme for contrast),
  `--accent2` (cyan/blue)
- Status: `--danger`, `--warn`, plus `-soft` variants of every color
  (`--accent-soft`, `--danger-soft`, etc.) for tinted badge/icon backgrounds
- `--on-accent` — text/icon color to use *on top of* an accent-colored background
- `--radius` (12px), `--shadow-sm`, `--shadow-md`
- `--font` (DM Sans, body/UI text), `--mono` (Space Mono, for numbers/data — use it
  anywhere a value is numeric so figures feel tabular and precise)

Two keyframes already exist and should be reused, not redefined: `fadeIn` (apply via
the `.fade-in` class on a page's root element for the standard page-entry animation)
and `pulse` (used by the `.skeleton` class — see Loading states below).

## Layout shell (`frontend/src/components/Layout.jsx`)

- Sidebar + `<main className="app-main">` flex row. Never put page padding back on
  individual pages — `.app-main` owns it (and steps it down responsively below
  900px/560px).
- The sidebar collapses to a 64px icon-only rail (`.sidebar.collapsed`), not to zero
  width. Collapsed state is `manualCollapsed !== null ? manualCollapsed : isNarrow`:
  a `matchMedia('(max-width: 900px)')` listener drives sensible auto-behavior until
  the user explicitly toggles it once, after which their explicit choice
  (persisted to `localStorage['sidebarCollapsed']`) wins regardless of width. Don't
  replace this with a plain boolean — it's what makes the sidebar responsive without
  fighting a manual preference.
- The active nav item gets a colored edge indicator (`.nav-link.active::after`), not
  just a background tint — `[dir="rtl"]` flips it to the other edge automatically.

## Every page starts the same way

```jsx
<div style={styles.page} className="fade-in">
  <PageHeader title={t('x.title')} subtitle={t('x.subtitle')} actions={<>...</>} />
  {/* filters/toolbar row, then content */}
</div>
```

`PageHeader` (`frontend/src/components/PageHeader.jsx`) takes `title`, `subtitle`,
and an optional `actions` node (buttons, right-aligned, wraps on narrow widths). Use
it instead of hand-rolling the `page-header`/`page-title`/`page-sub` markup — every
page does this and a shared component keeps future header tweaks in one place.

`styles.page` is almost always just `{ display: 'flex', flexDirection: 'column', gap: 20 }`
(20–24px). Keep this pattern rather than inventing new spacing rhythms per page.

## Cards, stats, and grids

- `.card` — the base surface for any grouped content (tables, forms, chart containers).
- `.stat-card` (used via `<StatCard>`) — for KPI-style numbers. Props: `label`,
  `value`, `sub`, `tone` (`accent`/`accent2`/`danger`/`warn`), `icon`, and optionally
  `delta` (a signed percentage number) with `deltaLabel`.
  - **Delta color is semantic, not directional.** An arrow pointing up isn't always
    "good" — more absences going up is bad. Pass `invertDelta` when a metric's "bad"
    direction is upward (e.g. absences, errors); the color (green/red) reflects
    whether the change is good or bad for that specific metric, while the arrow
    icon still reflects the literal direction. Get this wrong and the dashboard
    visually lies about whether things are improving.
- Grids of cards use `className="stat-grid"` (`repeat(auto-fit, minmax(220px, 1fr))`)
  so they reflow on narrower screens with zero extra media queries. Use this instead
  of a hardcoded `repeat(4, 1fr)` for anything that isn't a fixed-count form grid.

## Tables

- Base classes: `.table` / `.table th` / `.table td`, with a subtle row-hover.
- Numeric columns (counts, hours, money) get `className="num"` on both the `<th>`
  and `<td>` — right-aligns and switches to `--mono`. It uses `text-align: end`, so
  it mirrors correctly under Arabic RTL automatically — don't hardcode `right`.
- Empty tables/lists use `<EmptyState icon={SomeIcon}>{message}</EmptyState>`
  (`frontend/src/components/EmptyState.jsx`), not a bare `<p className="empty-state">`.
  Pick an icon that matches the content (e.g. `Inbox` for no punches, `Users` for no
  employees) — it's a small thing but it's the difference between a screen that
  looks broken and one that looks intentionally empty.

## Loading states

Use the skeleton components (`frontend/src/components/Skeleton.jsx`) instead of a
plain "Loading…" string — `<SkeletonBlock height={N}/>` for a chart/table-sized
placeholder, `<SkeletonStatCard/>` for stat-card grids, `<SkeletonBar/>` for inline
text-sized placeholders. They reuse the existing `pulse` keyframe, so no new CSS is
needed — just drop them in wherever a `loading` boolean currently renders text.

## Pickers

Never use a native `<input type="month">` or `type="date">` — this app has custom
pickers that match the rest of the UI and are already wired for i18n/RTL:
- `<MonthPicker value="YYYY-MM" onChange={...} />` — month/year grid.
- `<DatePicker value="YYYY-MM-DD" onChange={...} />` — full day calendar.

Both share the `.date-picker*` CSS shell (trigger button + popover) with grid-specific
styles layered on (`.month-picker-grid` / `.day-picker-grid`). If a future picker
variant is needed (e.g. a range picker), extend this shell rather than building a
new dropdown pattern from scratch.

## Charts (Recharts)

- Style `CartesianGrid`/`XAxis`/`YAxis`/`Tooltip` using the `--chart-line`,
  `--chart-label`, `--tooltip-*` tokens (see any existing chart for the exact prop
  shapes) so charts theme correctly.
- **Don't stack area charts across a status breakdown (present/absent/incomplete)
  purely because they're "categories."** Stacking makes whichever series is drawn
  last visually dominate the whole chart height — a chart stacking present + absent
  will look almost entirely covered by "absent" in alarming red even when most
  people are present, because stacking sums the values rather than showing each
  independently. Use independent overlaid `<Area>`s (no `stackId`) with semi-transparent
  fills instead, drawing the most important series (e.g. "present") last/on top with
  a heavier stroke so it reads clearly. Only stack when the *sum* is itself the
  meaningful quantity (e.g. bar chart totaling to "scheduled").

## i18n / RTL

- All user-facing text goes through `t('namespace.key')` — add the key to all three
  locale files (`frontend/src/i18n/locales/{en,fr,ar}.json`) in the same place in
  each file. After editing, verify key parity with a quick Node script that flattens
  each JSON file and diffs the key sets — this has caught mismatches every time it's
  been run and takes seconds.
- Dates/times/numbers: use `formatDate`/`formatTime`/`formatDateTime`/`localeFor`
  from `frontend/src/i18n/formatDate.js` rather than raw `toLocaleDateString`, so
  Arabic renders via `ar-DZ` (Western numerals, matching Algerian convention) instead
  of a generic Arabic locale.
- RTL comes almost for free from flexbox (`dir="rtl"` auto-mirrors `flex-direction:
  row`) and logical CSS properties (`text-align: end`, `border-inline-start`, etc.) —
  prefer those over `left`/`right`. Where a physical icon must flip meaning (e.g. a
  "previous" chevron, a panel-collapse icon), branch on `i18n.language === 'ar'` and
  swap to the mirrored icon explicitly, the way `Layout.jsx` and `MonthPicker.jsx` do
  — don't rely on CSS alone for icons that encode direction.

## Company branding

`useCompany()` (`frontend/src/context/CompanyContext.jsx`) exposes `companyName` and
`logoUrl`, sourced from Settings → General. Use it anywhere branding should appear
(sidebar header, report exports). **Never embed the logo `<img>` in an Excel/.xls
export** — Excel's HTML import turns `<img>` into a floating OLE object that ignores
CSS sizing and can substitute an unrelated placeholder graphic if the URL doesn't
resolve at open-time; text-only branding is safe there. The PDF/print export path
(a real browser rendering the HTML) handles the logo fine.

## Verification workflow

This app deploys via a full rebuild, not hot reload:
1. `cd frontend && npm run build`
2. `pm2 restart attendance-app` (from the repo root)
3. Browser-check the change in **both themes** and, for anything text/layout-related,
   in **Arabic** too (Settings → Language) — RTL bugs are easy to introduce and easy
   to miss if you only check English/LTR. Also check the browser console isn't
   swallowing a stale click before trusting a "no visible change" result — the
   automation environment sometimes shows stale renders after a client-side
   navigation; when in doubt, verify via a direct state check (e.g.
   `localStorage.getItem(...)`, `document.documentElement.getAttribute(...)`) rather
   than a screenshot alone.
