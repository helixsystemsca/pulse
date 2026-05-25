# Pulse UI system reference

Internal guide for consistent UI work. The product identity is an **operations-center / premium internal tool**: soft glass gradients, `ds-*` surfaces, dashboard-first layout, restrained motion.

**Do not** introduce a parallel visual language. Extend what exists in `app/globals.css` and shared primitives.

---

## 1. Theme system

### Semantic CSS variables (`app/globals.css`)

| Token | CSS variable | Typical use |
|-------|----------------|-------------|
| Primary (brand) | `--ds-brand-primary` → `--ds-accent` | Buttons, nav active, links, filled controls |
| Secondary | `--ds-brand-secondary` | Chrome / secondary text baseline |
| Accent | `--ds-brand-accent` | Highlights, secondary emphasis |
| Success | `--ds-brand-success` → `--ds-success` | Complete, compliant, OK |
| Warning | `--ds-brand-warning` → `--ds-warning` | Expiring, caution |
| Danger | `--ds-brand-danger` → `--ds-danger` | Missing, critical, errors |
| Page background | `--ds-bg` | `bg-ds-bg` |
| Surface primary | `--ds-surface-primary` | `bg-ds-primary` |
| Surface secondary | `--ds-surface-secondary` | `bg-ds-secondary` |
| Text primary | `--ds-text-primary` | `text-ds-foreground` |
| Text muted | `--ds-text-secondary` | `text-ds-muted` |
| Border | `--ds-border` | `border-ds-border` |
| Card shadow | `--ds-shadow-card` | Panels, tables |
| Motion | `--ds-transition-fast`, `--ds-transition-base` | Hovers, tabs |

Tailwind aliases live in `tailwind.config.ts` under `colors.ds.*`.

### TypeScript token map

`frontend/lib/theme/tokens.ts` — `CSS_VARS` and `TW` for programmatic references.

### Organization branding (5 colors)

| File | Role |
|------|------|
| `lib/theme/organization-branding.ts` | `OrganizationBrandColors`, defaults, localStorage preview, `applyOrganizationBrandColors()` |
| `components/theme/OrganizationThemeSync.tsx` | Applies colors on load / auth change |
| `components/organization/OrganizationBrandingThemeSection.tsx` | Admin UI under **Organization & branding** |
| `lib/pulse-session.ts` | `CompanySummary.brand_colors` (optional API field) |

**Flow:** Admin sets colors → stored in `localStorage` (`pulse-org-brand-colors:{companyId}`) until API persists → `OrganizationThemeSync` writes CSS variables on `<html>` → existing `--ds-accent`, `--ds-success`, etc. update app-wide.

**Event:** `pulse-org-theme-change` — dispatch after preview save.

### Light / dark mode

`components/theme/ThemeProvider.tsx` toggles `.dark` on `<html>`. Theme init runs in `app/layout.tsx` before paint.

---

## 2. Typography

| Level | Class / component | Usage |
|-------|-------------------|--------|
| Page title | `uiPageTitle` (`styles/ui-classes.ts`) or `PageHeader` | Feature h1 |
| Page description | `uiPageDescription` | Subcopy under title |
| Section label | `uiSectionTitle` or `SectionHeader` | Uppercase muted section labels |
| Subsection | `uiSubsectionTitle` | In-card headings |
| KPI label | `uiKpiLabel` | `text-[11px] font-semibold uppercase tracking-wide text-ds-muted` |
| KPI value | `uiKpiValue` | Large tabular numbers |
| Body | `text-sm text-ds-foreground` | Default copy |
| Muted | `text-ds-muted` / `text-sm text-ds-muted` | Helpers, descriptions |

Font stack: **Inter** (`--font-app`, `font-body`). Poppins only for navbar wordmark (`font-panoramaBrand` / `font-headline`).

---

## 3. Spacing & layout

| Pattern | Standard |
|---------|----------|
| Page vertical stack | `uiPageStack` → `space-y-6` |
| Section stack | `uiSectionStack` → `space-y-4` |
| App main padding | `px-3 py-4 lg:px-4` (`AppLayout`) |
| Legacy full page | `UI.page` / `UI.container` (`styles/ui.ts`) |
| Dashboard grid gap | `--pulse-dashboard-grid-gap` (18px) |
| Card radius (app) | `--ds-radius-card` (1rem) |
| Card radius (dashboard) | `--dash-card-radius` (1.25rem) |

**Dashboard surfaces** use `.dash-card`, `.dash-card--widget`, `.dash-card--hero` (see `globals.css`). Prefer `--static` variant when the card should not lift on hover.

**Data / admin panels** use `.ds-premium-panel` or `components/pulse/Card` variants (`ds-card-primary`, etc.).

---

## 4. Component primitives

| Component | Path | Notes |
|-----------|------|--------|
| **Card (canonical)** | `components/pulse/Card.tsx` | `variant`: primary \| secondary \| elevated; `padding`: none \| md \| lg |
| Card (legacy wrapper) | `components/ui/Card.tsx` | Delegates to pulse `Card` |
| **Page header** | `components/ui/PageHeader.tsx` | Icon + title + description + actions |
| **Section header** | `components/ui/SectionHeader.tsx` | Muted uppercase title |
| **Button** | `components/ui/Button.tsx` | Uses `styles/button-variants.ts` |
| **Metric / KPI** | `components/ui/MetricCard.tsx` | Pulse card + left accent border |
| **KPI (training)** | `components/training/dashboard/KPIStatCard.tsx` | `dash-card--widget` + `uiKpi*` classes |
| **Status badge** | `components/ui/StatusBadge.tsx` | Maps to `.app-badge-*` in globals |
| **Compliance badge** | `components/training/dashboard/ComplianceBadge.tsx` | Same badge system |
| **Data table shell** | `components/ui/DataTable.tsx` | Prefer `uiTable*` classes for new tables |
| **Forms** | `components/ui/ds-form-classes.ts` | `dsInputClass`, `dsLabelClass`, `dsFormHintClass` |
| **Modals** | `components/ui/premium-modal.tsx` | Layer z-index in `app-modal-layer.ts` |
| **Page shell** | `components/ui/PageWrapper.tsx` | `UI.page` + container |

### Shared class strings

`frontend/styles/ui-classes.ts` — import named exports instead of duplicating Tailwind strings (tabs, tables, callouts, links, icons).

`frontend/styles/ui.ts` — high-level page layout shortcuts.

### Buttons

`styles/button-variants.ts` + `styles/button-colors.ts`:

- Intents: `primary`, `secondary`, `accent`, `ghost`, `danger`, …
- Surfaces: `light` \| `dark` (chrome context)
- Use `<Button variant="primary" surface="light" />` — do not hand-roll teal/sky button classes.

---

## 5. Status system

### Badge CSS classes (`globals.css`)

`.app-badge-emerald`, `.app-badge-amber`, `.app-badge-red`, `.app-badge-blue`, `.app-badge-slate`, `.app-badge-amber-soft`, …

### TS maps

`lib/theme/status-variants.ts`:

- `STATUS_BADGE_CLASS` — `StatusBadge` variants
- `COMPLIANCE_BADGE_CLASS` — training compliance states
- `KPI_ACCENT_BAR_CLASS` — top bar on KPI cards

### Semantic colors

| Meaning | Token / badge |
|---------|----------------|
| Success / complete | `--ds-success`, `app-badge-emerald` |
| Warning / expiring | `--ds-warning`, `app-badge-amber` |
| Danger / missing | `--ds-danger`, `app-badge-red` |
| Info | `--ds-info`, `app-badge-blue` |
| Neutral | `app-badge-slate` |

Compliance matrix cells use training-specific components (`TrainingMatrixCell`, `ComplianceBadge`) — keep status colors aligned with tokens above.

---

## 6. Motion & transitions

| Token / pattern | Value |
|-----------------|--------|
| Fast | `--ds-transition-fast` (150ms ease) |
| Base | `--ds-transition-base` (200ms cubic-bezier) |
| Dashboard cards | 280ms transform/shadow (respects `prefers-reduced-motion`) |
| Tab / button hovers | `uiTransitionColors` |

**Avoid** new bounce/spring animations before the leadership review. No flashy entrance effects on operational pages.

---

## 7. Page structure guidelines

### Dashboards

- Wrapper: `.pulse-dashboard-surface` / `.ds-dashboard-shell` where applicable
- Widgets: `.dash-card.dash-card--widget.dash-card--static`
- KPI row: `KPIStatCard` or `MetricCard`
- Ops widgets: follow `components/dashboard/widgets/ops/*` (muted label `text-[10px] font-bold uppercase tracking-[0.1em]`)

### Training / compliance

- Domain shells: `components/training/domain/*` — `uiPageTitle`, `uiTabNav`, `uiTabLink*`
- Worker hub: `TrainingEmployeeSelfView` + `MyProceduresAssignmentsView` (account-scoped)
- Tables: `uiTableWrap` + `uiTableHead` / `uiTableCell`

### Admin / settings

- `PageHeader` + `pulse/Card` sections
- Forms: `ds-form-classes`
- Notifications: `.ds-notification`, `.ds-notification-success`, `.ds-notification-critical`

### Detail views

- Header block + inset panels (`.ds-premium-inset`) for nested content
- Actions right-aligned in header flex row (same as `PageHeader`)

---

## 8. Future development rules

1. **Reuse tokens** — `text-ds-foreground`, `border-ds-border`, `bg-ds-primary`; avoid raw `#0ea5e9` / `slate-*` in new code unless matching an existing ops widget pattern being extended.
2. **Reuse primitives** — `Button`, `StatusBadge`, `pulse/Card`, `ui-classes` before copying class strings.
3. **New variants** — Add to `status-variants.ts` or `button-variants.ts`, not one-off in feature folders.
4. **Global color changes** — Update `globals.css` defaults and/or organization branding apply path; document in this file.
5. **Theming expansion** — Persist `CompanySummary.brand_colors` via API; remove localStorage-only path when backend is ready. Do not build a multi-theme engine until product asks.
6. **Fragmentation smell** — Duplicate tab bars, bespoke KPI cards, hardcoded emerald/amber badge strings → normalize toward this doc.

### High-visibility audit targets (ongoing)

When touching an area, align to this system:

- `components/dashboard/*`
- `components/training/**`
- `components/standards/workforce-training/**`
- `components/organization/**`
- `components/app/AppNavbar.tsx`, `AppSideNav.tsx`

---

## File index (quick)

| Area | Path |
|------|------|
| CSS tokens & components | `app/globals.css` |
| Tailwind map | `tailwind.config.ts` |
| Theme TS | `lib/theme/*` |
| UI class strings | `styles/ui-classes.ts` |
| Layout shortcuts | `styles/ui.ts` |
| Buttons | `styles/button-variants.ts` |
| Status maps | `lib/theme/status-variants.ts` |
| Org theme sync | `components/theme/OrganizationThemeSync.tsx` |
