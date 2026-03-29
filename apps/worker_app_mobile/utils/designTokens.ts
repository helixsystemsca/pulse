/**
 * Visual tokens — pixel-tune against `Stitch Design/Home.png` (etc.) when those assets exist
 * in the project root; repo snapshot may not include the PNGs yet.
 */
export const colors = {
  canvas: "#EDF0F5",
  surface: "#FFFFFF",
  surfaceMuted: "#E2E8F0",
  border: "#D8DEE8",
  borderSubtle: "#EEF2F6",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textTertiary: "#94A3B8",
  accent: "#0F766E",
  accentSoft: "#CCFBF1",
  success: "#15803D",
  successSoft: "#DCFCE7",
  warning: "#C2410C",
  warningSoft: "#FFEDD5",
  danger: "#B91C1C",
  dangerSoft: "#FEE2E2",
  tabBar: "#FFFFFF",
  overlay: "rgba(15, 23, 42, 0.06)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  screenTitle: { fontSize: 13, fontWeight: "700" as const, letterSpacing: 0.6 },
  greeting: { fontSize: 26, fontWeight: "800" as const, letterSpacing: -0.5 },
  section: { fontSize: 15, fontWeight: "700" as const },
  body: { fontSize: 16, fontWeight: "500" as const },
  bodySm: { fontSize: 14, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "600" as const },
  micro: { fontSize: 11, fontWeight: "600" as const },
} as const;

export const layout = {
  screenPaddingH: 20,
  minTap: 52,
  headerTopPadding: 8,
  tabBarHeight: 60,
} as const;

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
} as const;
