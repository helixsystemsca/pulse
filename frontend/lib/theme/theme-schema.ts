/**
 * Organization theme design tokens — brand identity vs operational semantics.
 * Do not mix `semantic` colors into navigation/buttons; do not use `brand` for KPI status.
 */

export type ThemeBrandColors = {
  /** Primary buttons, active nav, key actions, focus, major highlights. */
  primary: string;
  /** Sidebars, secondary surfaces, elevated depth, gradients. */
  secondary: string;
  /** Selected states, graph highlights, links, sparse interactive emphasis. */
  accent: string;
  /** Hover overlays, transitions, button hover, subtle glow. */
  hover: string;
  /** Cards, modals, panels, inputs, contrast layering. */
  surface: string;
};

export type ThemeSemanticColors = {
  /** Healthy / compliant / completed / positive KPI. */
  success: string;
  /** Caution / pending / approaching threshold. */
  warning: string;
  /** Failure / downtime / SLA breach / critical KPI. */
  critical: string;
};

export type OrganizationTheme = {
  brand: ThemeBrandColors;
  semantic: ThemeSemanticColors;
};

export type ThemeBrandColorKey = keyof ThemeBrandColors;
export type ThemeSemanticColorKey = keyof ThemeSemanticColors;

export type ThemeColorTokenMeta = {
  key: string;
  label: string;
  purpose: string;
};

export const THEME_BRAND_TOKEN_META: readonly ThemeColorTokenMeta[] = [
  {
    key: "primary",
    label: "Primary",
    purpose:
      "Main brand color for primary buttons, active navigation, key actions, focus states, and major UI highlights.",
  },
  {
    key: "secondary",
    label: "Secondary",
    purpose:
      "Supporting brand color for depth, sidebars, secondary surfaces, elevated cards, and gradients.",
  },
  {
    key: "accent",
    label: "Accent",
    purpose:
      "High-visibility interaction color for active indicators, selected states, graph highlights, links, and emphasis.",
  },
  {
    key: "hover",
    label: "Hover",
    purpose:
      "Dedicated interaction color for hover states, active transitions, button hover overlays, and subtle glow.",
  },
  {
    key: "surface",
    label: "Surface",
    purpose:
      "Neutral surface color for cards, modals, panels, input backgrounds, and contrast layering.",
  },
] as const;

export const THEME_SEMANTIC_TOKEN_META: readonly ThemeColorTokenMeta[] = [
  {
    key: "success",
    label: "Success",
    purpose:
      "Healthy and compliant states, completed work, passing KPIs, uptime, and positive operational metrics.",
  },
  {
    key: "warning",
    label: "Warning",
    purpose:
      "Caution, pending attention, approaching thresholds, overdue soon, and moderate operational concerns.",
  },
  {
    key: "critical",
    label: "Critical",
    purpose:
      "Failures, downtime, high-priority alerts, SLA breaches, rejected inspections, and critical KPI states.",
  },
] as const;

/** Product defaults — aligned with `globals.css` :root. */
export const DEFAULT_ORGANIZATION_THEME: OrganizationTheme = {
  brand: {
    primary: "#0ea5e9",
    secondary: "#4c5454",
    accent: "#38bdf8",
    hover: "#7dd3fc",
    surface: "#f0efec",
  },
  semantic: {
    success: "#1ea896",
    warning: "#c9932e",
    critical: "#f6511d",
  },
};

const HEX_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function normalizeHexColor(value: string | null | undefined, fallback: string): string {
  const v = (value ?? "").trim();
  if (!HEX_RE.test(v)) return fallback;
  if (v.length === 4) {
    const r = v[1]!;
    const g = v[2]!;
    const b = v[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return v.toLowerCase();
}

function normalizeBrand(input: Partial<ThemeBrandColors> | null | undefined): ThemeBrandColors {
  const d = DEFAULT_ORGANIZATION_THEME.brand;
  return {
    primary: normalizeHexColor(input?.primary, d.primary),
    secondary: normalizeHexColor(input?.secondary, d.secondary),
    accent: normalizeHexColor(input?.accent, d.accent),
    hover: normalizeHexColor(input?.hover, d.hover),
    surface: normalizeHexColor(input?.surface, d.surface),
  };
}

function normalizeSemantic(input: Partial<ThemeSemanticColors> | null | undefined): ThemeSemanticColors {
  const d = DEFAULT_ORGANIZATION_THEME.semantic;
  return {
    success: normalizeHexColor(input?.success, d.success),
    warning: normalizeHexColor(input?.warning, d.warning),
    critical: normalizeHexColor(
      input?.critical ?? (input as { danger?: string } | undefined)?.danger,
      d.critical,
    ),
  };
}

/** Accepts nested theme, legacy flat `{ primary, … danger }`, or partial API payloads. */
export function normalizeOrganizationTheme(input: unknown): OrganizationTheme {
  if (!input || typeof input !== "object") {
    return normalizeOrganizationTheme(DEFAULT_ORGANIZATION_THEME);
  }
  const o = input as Record<string, unknown>;
  if (o.brand && typeof o.brand === "object") {
    return {
      brand: normalizeBrand(o.brand as Partial<ThemeBrandColors>),
      semantic: normalizeSemantic(o.semantic as Partial<ThemeSemanticColors>),
    };
  }
  return {
    brand: normalizeBrand({
      primary: o.primary as string | undefined,
      secondary: o.secondary as string | undefined,
      accent: o.accent as string | undefined,
      hover: o.hover as string | undefined,
      surface: o.surface as string | undefined,
    }),
    semantic: normalizeSemantic({
      success: o.success as string | undefined,
      warning: o.warning as string | undefined,
      critical: (o.critical ?? o.danger) as string | undefined,
    }),
  };
}
