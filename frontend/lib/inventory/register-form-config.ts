/**
 * Tenant-configurable register-item form — stored in inventory module settings.
 */
import type { InventoryModuleSettings } from "@/lib/inventoryService";

export type InventoryCategoryConfig = {
  id: string;
  name: string;
  options: string[];
};

export type InventoryRegisterFieldId =
  | "photo"
  | "name"
  | "sku"
  | "item_type"
  | "category"
  | "quantity"
  | "unit"
  | "low_stock_threshold"
  | "department_slug"
  | "condition"
  | "zone_id"
  | "assigned_user_id"
  | "linked_tool_id"
  | "vendor"
  | "unit_cost"
  | "reorder_flag";

export type InventorySelectOption = {
  value: string;
  label: string;
};

export type InventoryRegisterFieldConfig = {
  id: InventoryRegisterFieldId;
  enabled: boolean;
  label: string;
  required?: boolean;
  order: number;
  col_span?: 1 | 2;
  options?: InventorySelectOption[];
  placeholder?: string;
  help_text?: string;
};

export type InventoryRegisterFormConfig = {
  subtitle?: string;
  fields: InventoryRegisterFieldConfig[];
};

export const DEFAULT_INVENTORY_CATEGORY_NAMES = [
  "Tool",
  "Part",
  "Consumable",
  "Fasteners",
  "Electrical",
] as const;

export const DEFAULT_REGISTER_FORM_FIELDS: InventoryRegisterFieldConfig[] = [
  {
    id: "photo",
    enabled: true,
    label: "Photo",
    order: 5,
    col_span: 2,
    help_text: "Use your device camera or upload an image from files.",
  },
  {
    id: "name",
    enabled: true,
    label: "Name",
    required: true,
    order: 10,
    col_span: 2,
  },
  {
    id: "sku",
    enabled: true,
    label: "SKU (optional)",
    order: 20,
  },
  {
    id: "item_type",
    enabled: true,
    label: "Type",
    required: true,
    order: 30,
    options: [
      { value: "tool", label: "Tool" },
      { value: "part", label: "Part" },
      { value: "consumable", label: "Consumable" },
    ],
  },
  {
    id: "category",
    enabled: true,
    label: "Category",
    order: 40,
  },
  {
    id: "quantity",
    enabled: true,
    label: "Quantity",
    order: 50,
  },
  {
    id: "unit",
    enabled: true,
    label: "Unit",
    order: 60,
  },
  {
    id: "low_stock_threshold",
    enabled: true,
    label: "Min stock level",
    order: 70,
  },
  {
    id: "department_slug",
    enabled: true,
    label: "Department",
    order: 80,
  },
  {
    id: "condition",
    enabled: true,
    label: "Asset condition",
    order: 90,
    options: [
      { value: "good", label: "Good" },
      { value: "needs_maintenance", label: "Needs maintenance" },
      { value: "critical", label: "Critical / out of service" },
    ],
  },
  {
    id: "zone_id",
    enabled: true,
    label: "Location",
    order: 100,
  },
  {
    id: "assigned_user_id",
    enabled: true,
    label: "Assigned worker",
    order: 110,
  },
  {
    id: "linked_tool_id",
    enabled: true,
    label: "Linked asset",
    order: 120,
    col_span: 2,
  },
  {
    id: "vendor",
    enabled: true,
    label: "Vendor (optional)",
    order: 130,
    placeholder: "Supplier or manufacturer",
  },
  {
    id: "unit_cost",
    enabled: true,
    label: "Unit cost (optional)",
    order: 140,
  },
  {
    id: "reorder_flag",
    enabled: true,
    label: "Flag for reorder",
    order: 150,
  },
];

export const DEFAULT_REGISTER_FORM: InventoryRegisterFormConfig = {
  subtitle: "Tools are individually tracked; parts and consumables use quantity.",
  fields: DEFAULT_REGISTER_FORM_FIELDS,
};

function slugId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function normalizeInventoryCategories(raw: InventoryModuleSettings["categories"]): InventoryCategoryConfig[] {
  if (!raw?.length) {
    return DEFAULT_INVENTORY_CATEGORY_NAMES.map((name) => ({
      id: slugId(name) || `cat-${name}`,
      name,
      options: [],
    }));
  }
  if (typeof raw[0] === "string") {
    return (raw as string[]).map((name) => ({
      id: slugId(name) || `cat-${name}`,
      name: name.trim(),
      options: [],
    }));
  }
  return (raw as InventoryCategoryConfig[]).map((c) => ({
    id: c.id || slugId(c.name) || `cat-${c.name}`,
    name: c.name.trim(),
    options: (c.options ?? []).map((o) => o.trim()).filter(Boolean),
  }));
}

export function mergeRegisterFormConfig(raw?: InventoryRegisterFormConfig | null): InventoryRegisterFormConfig {
  const defaultsById = new Map(DEFAULT_REGISTER_FORM_FIELDS.map((f) => [f.id, f]));
  const incoming = raw?.fields ?? [];
  const merged: InventoryRegisterFieldConfig[] = [];

  for (const field of incoming) {
    if (!defaultsById.has(field.id)) continue;
    const base = defaultsById.get(field.id)!;
    merged.push({
      ...base,
      ...field,
      options: field.options?.length ? field.options : base.options,
    });
    defaultsById.delete(field.id);
  }

  for (const base of defaultsById.values()) {
    merged.push({ ...base });
  }

  merged.sort((a, b) => a.order - b.order);
  return {
    subtitle: raw?.subtitle?.trim() || DEFAULT_REGISTER_FORM.subtitle,
    fields: merged,
  };
}

export type MergedInventorySettings = {
  setup_completed: boolean;
  categories: InventoryCategoryConfig[];
  register_form: InventoryRegisterFormConfig;
  status_rules: Record<string, boolean>;
  threshold_defaults: { default_min?: number };
  locations: string[];
  assignment_rules: { checkout_required?: boolean };
  alerts: { low_stock?: boolean; missing?: boolean };
};

const DEFAULT_STATUS_RULES = {
  in_stock: true,
  assigned: true,
  low_stock: true,
  missing: true,
  maintenance: true,
};

export function mergeInventoryModuleSettings(raw: InventoryModuleSettings = {}): MergedInventorySettings {
  const categories = normalizeInventoryCategories(raw.categories);
  const hasLegacyConfig = Boolean(raw.categories?.length || raw.register_form?.fields?.length);
  return {
    setup_completed: raw.setup_completed ?? hasLegacyConfig,
    categories,
    register_form: mergeRegisterFormConfig(raw.register_form),
    status_rules: { ...DEFAULT_STATUS_RULES, ...raw.status_rules },
    threshold_defaults: { default_min: 5, ...raw.threshold_defaults },
    locations: [...(raw.locations ?? [])],
    assignment_rules: { checkout_required: true, ...raw.assignment_rules },
    alerts: { low_stock: true, missing: true, ...raw.alerts },
  };
}

export function inventoryCategoryLeafOptions(categories: InventoryCategoryConfig[]): string[] {
  const out = new Set<string>();
  for (const c of categories) {
    if (c.options.length) {
      c.options.forEach((o) => out.add(o));
    } else {
      out.add(c.name);
    }
  }
  return [...out];
}

export function resolveStoredCategory(
  categories: InventoryCategoryConfig[],
  stored: string | null | undefined,
): { groupId: string; value: string } {
  const v = (stored ?? "").trim();
  if (!v) return { groupId: "", value: "" };
  for (const c of categories) {
    if (c.options.includes(v)) return { groupId: c.id, value: v };
    if (c.name === v) return { groupId: c.id, value: c.options.length ? "" : v };
  }
  return { groupId: "", value: v };
}

export function categoryValueForSave(
  categories: InventoryCategoryConfig[],
  groupId: string,
  leaf: string,
): string | null {
  const group = categories.find((c) => c.id === groupId);
  if (!group) return leaf.trim() || null;
  const picked = leaf.trim();
  if (picked) return picked;
  if (!group.options.length) return group.name;
  return null;
}

export function enabledRegisterFields(config: InventoryRegisterFormConfig): InventoryRegisterFieldConfig[] {
  return config.fields.filter((f) => f.enabled).sort((a, b) => a.order - b.order);
}

export function settingsPayloadFromMerged(merged: MergedInventorySettings): InventoryModuleSettings {
  return {
    setup_completed: merged.setup_completed,
    categories: merged.categories,
    register_form: merged.register_form,
    status_rules: merged.status_rules,
    threshold_defaults: merged.threshold_defaults,
    locations: merged.locations,
    assignment_rules: merged.assignment_rules,
    alerts: merged.alerts,
  };
}

export function newCategoryDraft(name = ""): InventoryCategoryConfig {
  const trimmed = name.trim();
  return {
    id: slugId(trimmed) || `cat-${Date.now()}`,
    name: trimmed,
    options: [],
  };
}
