export const darkTheme = {
  colors: {
    background: "#4C6085", // dusk blue
    surface: "#556B8E",
    card: "#5E7598",
    border: "rgba(255,255,255,0.08)",

    text: "#FFFFFF",
    muted: "rgba(255,255,255,0.6)",
    /** Readable on light frosted header (same family as `background`). */
    headerGlassText: "#4C6085",
    headerGlassMuted: "rgba(76, 96, 133, 0.78)",

    success: "#36F1CD", // aquamarine
    warning: "#F2BB05", // amber
    danger: "#EB5160", // lobster
  },
  radii: {
    sm: 10,
    md: 14,
    lg: 18,
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },
  text: {
    h1: { fontSize: 22, fontWeight: "700" as const },
    h2: { fontSize: 18, fontWeight: "700" as const },
    body: { fontSize: 14, fontWeight: "500" as const },
    small: { fontSize: 12, fontWeight: "600" as const },
  },
};

export const lightTheme = {
  colors: {
    background: "#F6F8FC",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    border: "rgba(15,23,42,0.10)",

    text: "#0F172A",
    muted: "rgba(15,23,42,0.55)",
    headerGlassText: "#0F172A",
    headerGlassMuted: "rgba(15,23,42,0.60)",

    success: "#36F1CD",
    warning: "#F2BB05",
    danger: "#EB5160",
  },
  radii: darkTheme.radii,
  spacing: darkTheme.spacing,
  text: darkTheme.text,
};

export const theme = darkTheme;

export type PulseTheme = typeof darkTheme;

