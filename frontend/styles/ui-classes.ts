/**
 * Canonical Tailwind class strings — single source for UI consistency.
 * Import these instead of re-stating one-off typography/spacing in feature code.
 */

/** Page & section typography */
export const uiPageTitle = "text-lg font-bold tracking-tight text-ds-foreground md:text-xl";
export const uiPageDescription = "max-w-3xl text-sm leading-relaxed text-ds-muted";
export const uiSectionTitle = "text-sm font-semibold uppercase tracking-wide text-ds-muted";
export const uiSectionDescription = "mt-1 text-sm text-ds-muted";
export const uiSubsectionTitle = "text-base font-semibold text-ds-foreground";

/** Layout rhythm */
export const uiPageStack = "space-y-6";
export const uiSectionStack = "space-y-4";
export const uiCardStack = "space-y-3";
export const uiInlineGap = "gap-2";
export const uiToolbarGap = "gap-1";

/** Surfaces — prefer `pulse/Card` or these shells */
export const uiPremiumPanel = "ds-premium-panel";
export const uiDashCardWidget = "dash-card dash-card--widget dash-card--static";
export const uiDashCardStandard = "dash-card dash-card--standard dash-card--static";

/** Tables / data density */
export const uiTableWrap = "overflow-hidden rounded-xl border border-ds-border/90 shadow-[var(--ds-shadow-card)]";
export const uiTableHead =
  "border-b border-ds-border/80 bg-ds-secondary/40 text-[11px] font-bold uppercase tracking-wide text-ds-muted";
export const uiTableCell = "px-3 py-2 text-sm text-ds-foreground";
export const uiTableRow = "border-b border-ds-border/60 dark:border-ds-border/60";

/** Tabs (Training / Compliance section nav pattern) */
export const uiTabNav = "flex flex-wrap gap-1 border-b border-ds-border pb-2";
export const uiTabLink =
  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition";
export const uiTabLinkActive = "bg-ds-primary text-white";
export const uiTabLinkIdle = "text-ds-muted hover:bg-ds-muted/30 hover:text-ds-foreground";

/** Links */
export const uiTextLink = "font-semibold text-teal-700 hover:underline dark:text-teal-300";
export const uiAccentLink = "font-semibold text-ds-accent underline-offset-2 hover:underline";

/** Callouts */
export const uiCalloutWarning =
  "rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100";
export const uiCalloutInfo =
  "rounded-lg border border-dashed border-ds-border bg-ds-muted/10 p-4 text-sm text-ds-muted";

/** Motion */
export const uiTransitionColors = "transition-colors duration-200 ease-out";
export const uiTransitionSurface =
  "transition-[box-shadow,transform,background-color] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]";

/** Icons */
export const uiIconSm = "h-4 w-4 shrink-0";
export const uiIconMd = "h-5 w-5 shrink-0";
export const uiIconInTab = "h-4 w-4 shrink-0";
export const uiIconStroke = 2;

/** KPI label (matches MetricCard / dashboard widgets) */
export const uiKpiLabel = "text-[11px] font-semibold uppercase tracking-wide text-ds-muted";
export const uiKpiValue = "font-headline text-2xl font-bold tabular-nums tracking-tight text-ds-foreground";
