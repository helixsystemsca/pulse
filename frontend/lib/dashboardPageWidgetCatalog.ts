/**
 * Catalog for Operations dashboard "custom peek" widgets: pick a Pulse page, then
 * which slices to surface. Options are stored per widget instance (localStorage).
 */

import type { CSSProperties } from "react";

import type { DashboardAccentPreset } from "@/lib/dashboardAccentPresets";

export type WidgetFieldType = "boolean" | "number";

export type WidgetCustomField = {
  key: string;
  label: string;
  type: WidgetFieldType;
  default: boolean | number;
  min?: number;
  max?: number;
  step?: number;
};

export type DashboardWidgetSlice = {
  id: string;
  label: string;
  description?: string;
  customizableFields?: WidgetCustomField[];
};

export type DashboardPageDefinition = {
  id: string;
  label: string;
  href: string;
  description: string;
  slices: DashboardWidgetSlice[];
};

export const DASHBOARD_PAGE_WIDGET_CATALOG: DashboardPageDefinition[] = [
  {
    id: "monitoring",
    label: "Monitoring",
    href: "/monitoring",
    description: "Pools, CO₂, and other system signals (demo data matches the Monitoring page until live feeds are wired).",
    slices: [
      {
        id: "pool_controllers",
        label: "Pool controllers",
        description: "Chlorine, pH, flow, and temperature at a glance.",
        customizableFields: [
          { key: "showChlorine", label: "Show chlorine", type: "boolean", default: true },
          { key: "showPh", label: "Show pH", type: "boolean", default: true },
          { key: "showFlow", label: "Show flow", type: "boolean", default: true },
          { key: "showTemp", label: "Show temperature", type: "boolean", default: true },
        ],
      },
      {
        id: "co2_tanks",
        label: "CO₂ tanks",
        description: "Roll-up health: green when every tank is at or above your minimum level.",
        customizableFields: [
          {
            key: "minLevel",
            label: "Healthy if level ≥",
            type: "number",
            default: 300,
            min: 0,
            max: 1000,
            step: 10,
          },
          { key: "showPerTank", label: "Show per-tank rows", type: "boolean", default: true },
        ],
      },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/dashboard/inventory",
    description: "Stock posture from the same signals as the Inventory module.",
    slices: [
      {
        id: "consumables_status",
        label: "Consumables status",
        customizableFields: [{ key: "showLink", label: "Show link to Inventory", type: "boolean", default: true }],
      },
      { id: "low_stock_alert", label: "Low-stock alert" },
      {
        id: "shopping_list",
        label: "Shopping list preview",
        customizableFields: [
          { key: "maxItems", label: "Max lines to show", type: "number", default: 5, min: 1, max: 20, step: 1 },
        ],
      },
    ],
  },
  {
    id: "work_requests",
    label: "Work requests",
    href: "/dashboard/work-requests",
    description: "Triage snapshot from maintenance / work requests.",
    slices: [
      { id: "wr_queue", label: "Awaiting assignment & newest item" },
      {
        id: "wr_critical",
        label: "Critical / high-priority list",
        customizableFields: [
          { key: "maxItems", label: "Max items", type: "number", default: 4, min: 1, max: 12, step: 1 },
        ],
      },
    ],
  },
  {
    id: "equipment",
    label: "Equipment",
    href: "/equipment",
    description: "Beacon / tool health counts from the dashboard model.",
    slices: [{ id: "equipment_counts", label: "Active, missing, out of service" }],
  },
  {
    id: "training",
    label: "Training",
    href: "/standards/training",
    description: "Compliance roll-up for mandatory training programs.",
    slices: [{ id: "training_compliance", label: "Training compliance" }],
  },
];

export type CustomWidgetSliceOptions = Record<string, Record<string, boolean | number>>;

export type CustomDashboardWidgetConfig = {
  /** Layout grid id */
  id: string;
  pageId: string;
  sliceIds: string[];
  /** Per-slice field overrides (sliceId -> field key -> value) */
  sliceOptions: CustomWidgetSliceOptions;
  title: string;
};

export const DASHBOARD_LAYOUT_STORAGE_V2 = "dashboard_layout_v2";

export type DashboardWidgetStyleOverride = {
  /** Soft color story when no custom `backgroundColor` is set. */
  accentPreset?: DashboardAccentPreset;
  /** Used as a tint or base background. Any valid CSS color string. */
  backgroundColor?: string;
  /** Foreground color for the widget chrome (title + default text). Any valid CSS color string. */
  textColor?: string;
  /** CSS font-family string (e.g. `var(--font-app)` or `Poppins, system-ui, sans-serif`). */
  fontFamily?: string;
  /** When set, controls how the widget background is rendered. */
  theme?: "tint" | "solid" | "glass" | "gradient";
  /** Extra stroke width in px (0 = use default card border only). */
  widgetBorderWidth?: number;
  /** Stroke color when `widgetBorderWidth` &gt; 0. */
  widgetBorderColor?: string;
  /** Additional drop shadow layered with optional glow. */
  shadowPreset?: DashboardWidgetShadowPreset;
  /** Outer glow layered in `box-shadow` after shadow preset. */
  glowEnabled?: boolean;
  glowColor?: string;
  /** 1–100; blur radius scales with this when glow is enabled. */
  glowStrength?: number;
};

export const DASHBOARD_WIDGET_STYLE_STORAGE = "dashboard_widget_styles_v1";
export const DASHBOARD_LAYOUT_STORAGE_V1 = "dashboard_layout_v1";
export const DASHBOARD_CUSTOM_WIDGETS_STORAGE = "dashboard_custom_widgets_v1";

/** Extra elevation beyond the default `.dash-card` shadow (merged into `box-shadow`). */
export type DashboardWidgetShadowPreset = "none" | "soft" | "medium" | "deep";

const SHADOW_PRESET_CSS: Record<Exclude<DashboardWidgetShadowPreset, "none">, string> = {
  soft: "0 4px 18px -4px rgba(15, 23, 42, 0.1), 0 2px 8px -3px rgba(15, 23, 42, 0.06)",
  medium: "0 14px 36px -12px rgba(15, 23, 42, 0.18), 0 6px 14px -6px rgba(15, 23, 42, 0.1)",
  deep: "0 24px 52px -16px rgba(15, 23, 42, 0.26), 0 12px 28px -12px rgba(15, 23, 42, 0.14)",
};

/**
 * Inline styles for stroke, drop shadow, and glow — merged onto widget shells (`WorkerDashCard`, accent/column panels).
 * Omits properties when unset so default `.dash-card` chrome still applies.
 */
export function dashboardWidgetChromeStyle(o?: DashboardWidgetStyleOverride): CSSProperties {
  if (!o) return {};
  const layers: string[] = [];
  const preset = o.shadowPreset ?? "none";
  if (preset !== "none" && preset in SHADOW_PRESET_CSS) {
    layers.push(SHADOW_PRESET_CSS[preset as keyof typeof SHADOW_PRESET_CSS]);
  }
  const glowHex = (o.glowColor ?? "").trim();
  if (o.glowEnabled && glowHex) {
    const raw = o.glowStrength ?? 48;
    const strength = Math.min(100, Math.max(1, raw));
    const blurPx = Math.round(8 + (strength / 100) * 36);
    layers.push(`0 0 ${blurPx}px ${glowHex}`);
  }

  const bw = Math.min(6, Math.max(0, o.widgetBorderWidth ?? 0));
  const out: CSSProperties = {};
  if (layers.length) {
    out.boxShadow = layers.join(", ");
  }
  if (bw > 0) {
    out.borderWidth = bw;
    out.borderStyle = "solid";
    out.borderColor = (o.widgetBorderColor ?? "").trim() || "rgba(15, 23, 42, 0.16)";
    out.boxSizing = "border-box";
  }
  return out;
}

export function catalogPage(pageId: string): DashboardPageDefinition | undefined {
  return DASHBOARD_PAGE_WIDGET_CATALOG.find((p) => p.id === pageId);
}

export function defaultSliceOptions(page: DashboardPageDefinition, sliceIds: string[]): CustomWidgetSliceOptions {
  const out: CustomWidgetSliceOptions = {};
  for (const sid of sliceIds) {
    const slice = page.slices.find((s) => s.id === sid);
    if (!slice?.customizableFields?.length) continue;
    const row: Record<string, boolean | number> = {};
    for (const f of slice.customizableFields) {
      row[f.key] = f.default;
    }
    out[sid] = row;
  }
  return out;
}

export function newCustomWidgetId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return `cw_${crypto.randomUUID()}`;
  return `cw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
