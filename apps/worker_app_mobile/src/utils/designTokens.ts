/** Industrial SaaS field UI — minimal, high contrast, calm teal accent. */
export const colors = {
  canvas: "#EEF1F6",
  surface: "#FFFFFF",
  surfaceElevated: "#F8FAFC",
  border: "#D1D9E6",
  borderSubtle: "#E8EDF4",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textTertiary: "#94A3B8",
  accent: "#0D9488",
  accentMuted: "#99F6E4",
  success: "#059669",
  successSoft: "#D1FAE5",
  warning: "#D97706",
  warningSoft: "#FEF3C7",
  danger: "#DC2626",
  dangerSoft: "#FEE2E2",
  tabBar: "#FFFFFF",
  tabInactive: "#94A3B8",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const typography = {
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, fontWeight: "600" as const },
  body: { fontSize: 16, fontWeight: "500" as const },
  bodySm: { fontSize: 14, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "600" as const },
  micro: { fontSize: 11, fontWeight: "600" as const },
} as const;

export const layout = {
  screenPaddingH: 20,
  tabBarHeight: 58,
  minTap: 48,
} as const;

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
} as const;
