export type DashboardContext = "worker" | "operations" | "admin";

export type DashboardMode = "standard" | "kiosk";

/**
 * UI density level for widget templates.
 * Widgets should reveal more data as density increases.
 */
export type WidgetDensity = "compact" | "standard" | "expanded" | "xl";

