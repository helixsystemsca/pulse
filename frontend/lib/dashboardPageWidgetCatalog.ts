/**
 * Catalog for Operations dashboard "custom peek" widgets: pick a Pulse page, then
 * which slices to surface. Options are stored per widget instance (localStorage).
 */

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
  /** Used as a tint for the frosted surface. Any valid CSS color string. */
  backgroundColor?: string;
  /** Foreground color for the widget chrome (title + default text). Any valid CSS color string. */
  textColor?: string;
  /** CSS font-family string (e.g. `var(--font-app)` or `Poppins, system-ui, sans-serif`). */
  fontFamily?: string;
};

export const DASHBOARD_WIDGET_STYLE_STORAGE = "dashboard_widget_styles_v1";
export const DASHBOARD_LAYOUT_STORAGE_V1 = "dashboard_layout_v1";
export const DASHBOARD_CUSTOM_WIDGETS_STORAGE = "dashboard_custom_widgets_v1";

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
