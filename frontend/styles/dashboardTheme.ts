/**
 * Kiosk / operations dashboard layout tokens (see `docs/dashboard/dashboard.md`
 * and `docs/dashboard/Pool Shutdown Kiosk - Standalone.html`).
 * Premium card shells use `.dash-card*` from `app/globals.css`.
 */
export type DashboardCardTier = "hero" | "standard" | "board";

export type DashboardSurfaceTheme = "tint" | "glass" | "gradient" | "solid";

const GRADIENT_BG =
  "bg-[radial-gradient(900px_420px_at_20%_10%,color-mix(in_srgb,var(--widget-tint,white)_38%,transparent),transparent_58%),radial-gradient(700px_420px_at_85%_15%,color-mix(in_srgb,var(--ds-accent)_18%,transparent),transparent_60%),color-mix(in_srgb,var(--ds-bg)_62%,#ffffff_38%)]";

/**
 * Header / summary cards — tier picks gradient intensity; theme overrides for custom widgets.
 */
export function dashboardAccentShell(theme: DashboardSurfaceTheme, tier: DashboardCardTier): string {
  if (theme === "glass") {
    return "dash-card dash-card--static pulse-apple-glass";
  }
  if (theme === "solid") {
    return `dash-card dash-card--static bg-[var(--widget-tint,white)]`;
  }
  if (theme === "gradient") {
    return `dash-card ${GRADIENT_BG}`;
  }
  if (tier === "hero") {
    return "dash-card dash-card--hero";
  }
  if (tier === "board") {
    return "dash-card dash-card--board dash-card--static";
  }
  return "dash-card dash-card--standard";
}

/** Side columns (kiosk lists, etc.). */
export function dashboardColumnShell(theme: DashboardSurfaceTheme): string {
  if (theme === "glass") {
    return "dash-card dash-card--static pulse-apple-glass";
  }
  if (theme === "solid") {
    return `dash-card dash-card--static bg-[var(--widget-tint,white)]`;
  }
  if (theme === "gradient") {
    return `dash-card ${GRADIENT_BG}`;
  }
  return "dash-card dash-card--column";
}

/** Grid widgets — modular tiles with soft pastel depth. */
export function dashboardWidgetShell(theme: DashboardSurfaceTheme): string {
  if (theme === "glass") {
    return "dash-card dash-card--static pulse-apple-glass";
  }
  if (theme === "solid") {
    return `dash-card dash-card--static bg-[var(--widget-tint,white)]`;
  }
  if (theme === "gradient") {
    return `dash-card ${GRADIENT_BG}`;
  }
  return "dash-card dash-card--widget";
}

export const DASH = {
  /** Full-width dashboard canvas (no extra chrome). */
  page: "w-full",
  /** Primary 12-column rhythm. */
  grid12: "grid grid-cols-12 gap-3",
  /** Framed board on kiosk pages — outer frame only; inner cards use `.dash-card`. */
  kioskFrame:
    "w-full rounded-[var(--dash-card-radius-hero)] border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,rgb(255_255_255_/0.5))] bg-[linear-gradient(165deg,rgb(255_255_255_/0.92),rgb(248_250_253_/0.88))] p-4 shadow-[var(--dash-shadow-card-mid)] backdrop-blur-xl dark:border-[rgb(255_255_255_/0.1)] dark:bg-[linear-gradient(165deg,color-mix(in_srgb,var(--ds-surface-primary)_92%,#020617),color-mix(in_srgb,var(--ds-surface-secondary)_90%,#020617))] dark:shadow-[0_8px_40px_rgb(0_0_0_/0.35)]",
  /**
   * Generic elevated tile (tool panels, kiosk metrics) — premium widget shell.
   * Prefer {@link dashboardWidgetShell} when theme comes from widget overrides.
   */
  cardBase: "dash-card dash-card--widget",
  cardInner: "p-3.5 sm:p-4",
  /** Brand strip under header / column chrome. */
  accentBar: "h-[3px] w-full shrink-0 bg-[var(--ds-chrome-gradient)]",
  accentBarMuted: "h-px w-full shrink-0 bg-[color-mix(in_srgb,var(--ds-text-primary)_12%,transparent)]",
  sectionLabel: "dash-section-title",
  kpiTile:
    "rounded-[var(--dash-card-radius)] border border-[rgb(226_232_240/0.9)] bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-3.5 shadow-[var(--dash-shadow-ops-widget)] transition-[transform,box-shadow] duration-300 ease-out motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[var(--dash-shadow-card-hover)] dark:border-[rgb(255_255_255_/0.1)]",
  /** Inner stat tiles for custom page peek widgets — matches premium KPI card rhythm (label / body / footer). */
  peekStatCard:
    "rounded-[var(--dash-card-radius)] border border-[rgb(226_232_240/0.85)] bg-[linear-gradient(180deg,#ffffff_0%,#f4f7fb_100%)] p-4 shadow-[var(--dash-shadow-card-soft)] dark:bg-[linear-gradient(165deg,color-mix(in_srgb,var(--ds-surface-primary)_96%,transparent),color-mix(in_srgb,var(--ds-surface-secondary)_94%,#020617))] dark:shadow-[0_4px_14px_rgb(0_0_0_/0.28)]",
  peekStatLabel: "dash-kpi-label",
  kpiValue: "dash-kpi-value mt-1.5",
  kpiLabel: "dash-kpi-label",
  listRow:
    "rounded-[14px] border border-[color-mix(in_srgb,var(--ds-text-primary)_7%,rgb(255_255_255_/0.45))] bg-[linear-gradient(180deg,rgb(255_255_255_/0.88),rgb(252_253_255_/0.92))] px-3 py-2.5 shadow-[0_1px_0_rgb(255_255_255_/0.72)_inset,0_6px_18px_-10px_rgb(15_23_42_/0.1)] backdrop-blur-sm dark:border-ds-border dark:bg-[color-mix(in_srgb,var(--ds-surface-secondary)_85%,transparent)]",
  pill: "inline-flex shrink-0 items-center rounded-md border border-ds-border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide",
} as const;
