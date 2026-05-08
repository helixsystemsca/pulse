/**
 * Kiosk / operations dashboard layout tokens (see `docs/dashboard/dashboard.md`
 * and `docs/dashboard/Pool Shutdown Kiosk - Standalone.html`).
 * Uses design-system CSS variables from `app/globals.css`.
 */
export const DASH = {
  /** Full-width dashboard canvas (no extra chrome). */
  page: "w-full",
  /** Primary 12-column rhythm. */
  grid12: "grid grid-cols-12 gap-3",
  /** Framed board on kiosk pages. */
  kioskFrame:
    "w-full rounded-[16px] border border-[rgba(120,140,160,0.16)] bg-white/55 p-3 shadow-[0_10px_34px_rgba(15,23,42,0.06)] backdrop-blur-md dark:border-ds-border dark:bg-ds-bg dark:shadow-[0_14px_46px_rgba(0,0,0,0.28)]",
  /** Operational widget surface (match Team Insights cards). */
  cardBase:
    // Use ds-card-static to opt out of default hover tint (gray wash),
    // then re-add a subtle glow (no tint shift) explicitly.
    "ds-card-primary ds-card-static overflow-hidden rounded-2xl border border-ds-border shadow-[var(--ds-shadow-card)] transition-[box-shadow] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ds-accent)_22%,transparent),0_8px_26px_rgba(15,23,42,0.10)] dark:hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--ds-accent)_28%,transparent),0_10px_30px_rgba(0,0,0,0.32)]",
  cardInner: "p-3.5 sm:p-4",
  /** Brand strip under header / column chrome. */
  accentBar: "h-[3px] w-full shrink-0 bg-[var(--ds-chrome-gradient)]",
  accentBarMuted: "h-0.5 w-full shrink-0 bg-ds-border",
  sectionLabel: "text-[11px] font-bold uppercase tracking-[0.16em] text-ds-muted",
  kpiTile:
    "rounded-[16px] border border-[rgba(120,140,160,0.14)] bg-white/60 p-3 shadow-[0_10px_26px_rgba(15,23,42,0.05)] backdrop-blur-md dark:border-ds-border dark:bg-ds-secondary/70 dark:shadow-none",
  kpiValue: "mt-1 font-headline text-[26px] font-semibold leading-none tabular-nums text-ds-foreground",
  kpiLabel: "text-[11px] font-semibold uppercase tracking-wider text-ds-muted",
  listRow:
    "rounded-[14px] border border-[rgba(120,140,160,0.14)] bg-white/55 px-3 py-2.5 backdrop-blur-sm dark:border-ds-border dark:bg-ds-secondary/50",
  pill: "inline-flex shrink-0 items-center rounded-md border border-ds-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
} as const;
