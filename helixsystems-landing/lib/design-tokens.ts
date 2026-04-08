/**
 * Pulse design system — semantic themes (source of truth in `app/globals.css` as `--ds-*`).
 * Use these objects for documentation, charts (e.g. stroke colors), or runtime reads only when CSS vars are unavailable.
 */
export const lightTheme = {
  background: "#FFEEDB",
  surfacePrimary: "#ffffff",
  surfaceSecondary: "#fff7ed",
  surfaceElevated: "#fdf1e3",
  border: "rgba(0,0,0,0.06)",
  textPrimary: "#1a1a1a",
  textSecondary: "rgba(0,0,0,0.6)",
  success: "#36F1CD",
  warning: "#F2BB05",
  danger: "#EB5160",
} as const;

export const darkTheme = {
  background: "#4C6085",
  surfacePrimary: "#3f5274",
  surfaceSecondary: "#354766",
  surfaceElevated: "#2c3a55",
  border: "rgba(255,255,255,0.08)",
  textPrimary: "#ffffff",
  textSecondary: "rgba(255,255,255,0.7)",
  success: "#36F1CD",
  warning: "#F2BB05",
  danger: "#EB5160",
} as const;

export type DesignThemeMode = "light" | "dark";
