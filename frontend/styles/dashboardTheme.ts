/**
 * Kiosk / operations dashboard layout tokens (see `docs/dashboard/dashboard.md`
 * and `docs/dashboard/Pool Shutdown Kiosk - Standalone.html`).
 * Uses design-system CSS variables from `app/globals.css`.
 */
export const DASH = {
  /** Full-width dashboard canvas (no extra chrome). */
  page: "w-full",
  /** Primary 12-column rhythm. */
  grid12: "grid grid-cols-12 gap-4",
  /** Framed board on kiosk pages. */
  kioskFrame: "w-full rounded-[10px] border border-ds-border bg-ds-bg p-3 sm:p-4",
  /** White panel + 1px border (Pool mock: cards on #f7f9fb). */
  cardBase:
    "overflow-hidden rounded-[var(--pulse-dashboard-card-radius)] border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]",
  cardInner: "p-4 sm:p-4",
  /** Brand strip under header / column chrome. */
  accentBar: "h-[3px] w-full shrink-0 bg-[var(--ds-chrome-gradient)]",
  accentBarMuted: "h-0.5 w-full shrink-0 bg-ds-border",
  sectionLabel: "text-[11px] font-bold uppercase tracking-[0.16em] text-ds-muted",
  kpiTile: "rounded-xl border border-ds-border bg-ds-secondary/70 p-3",
  kpiValue: "mt-1 font-headline text-2xl font-semibold tabular-nums text-ds-foreground",
  kpiLabel: "text-[11px] font-semibold uppercase tracking-wider text-ds-muted",
  listRow: "rounded-lg border border-ds-border bg-ds-secondary/50 px-3 py-2.5",
  pill: "inline-flex shrink-0 items-center rounded-md border border-ds-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
} as const;
