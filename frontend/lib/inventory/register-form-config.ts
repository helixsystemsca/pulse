/**

 * Tenant-configurable register-item form — stored in inventory module settings.

 */

import type { InventoryModuleSettings } from "@/lib/inventoryService";



export type InventoryBuiltinFieldId =

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



export type InventoryFieldInputType =

  | "text"

  | "number"

  | "select"

  | "checkbox"

  | "photo"

  | "zone_select"

  | "worker_select"

  | "asset_select"

  | "department_select";



export type InventorySelectOption = {

  value: string;

  label: string;

};



export type InventoryRegisterFieldConfig = {

  id: string;

  enabled: boolean;

  label: string;

  required?: boolean;

  order: number;

  col_span?: 1 | 2;

  input_type: InventoryFieldInputType;

  is_custom?: boolean;

  options?: InventorySelectOption[];

  placeholder?: string;

  help_text?: string;

};



export type InventoryRegisterFormConfig = {

  subtitle?: string;

  fields: InventoryRegisterFieldConfig[];

};



const BUILTIN_FIELD_IDS = new Set<string>([

  "photo",

  "name",

  "sku",

  "item_type",

  "category",

  "quantity",

  "unit",

  "low_stock_threshold",

  "department_slug",

  "condition",

  "zone_id",

  "assigned_user_id",

  "linked_tool_id",

  "vendor",

  "unit_cost",

  "reorder_flag",

]);



const DEFAULT_INPUT_TYPES: Record<InventoryBuiltinFieldId, InventoryFieldInputType> = {

  photo: "photo",

  name: "text",

  sku: "text",

  item_type: "select",

  category: "text",

  quantity: "number",

  unit: "text",

  low_stock_threshold: "number",

  department_slug: "department_select",

  condition: "select",

  zone_id: "zone_select",

  assigned_user_id: "worker_select",

  linked_tool_id: "asset_select",

  vendor: "text",

  unit_cost: "number",

  reorder_flag: "checkbox",

};



export const DEFAULT_REGISTER_FORM_FIELDS: InventoryRegisterFieldConfig[] = [

  {

    id: "photo",

    enabled: true,

    label: "Photo",

    order: 5,

    col_span: 2,

    input_type: "photo",

    help_text: "Shown on the item profile. Use your device camera or upload from files.",

  },

  {

    id: "name",

    enabled: true,

    label: "Name",

    required: true,

    order: 10,

    col_span: 2,

    input_type: "text",

  },

  {

    id: "sku",

    enabled: true,

    label: "SKU (optional)",

    order: 20,

    input_type: "text",

  },

  {

    id: "item_type",

    enabled: true,

    label: "Type",

    required: true,

    order: 30,

    input_type: "select",

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

    input_type: "text",

  },

  {

    id: "quantity",

    enabled: true,

    label: "Quantity",

    order: 50,

    input_type: "number",

  },

  {

    id: "unit",

    enabled: true,

    label: "Unit",

    order: 60,

    input_type: "text",

  },

  {

    id: "low_stock_threshold",

    enabled: true,

    label: "Min stock level",

    order: 70,

    input_type: "number",

  },

  {

    id: "department_slug",

    enabled: true,

    label: "Department",

    order: 80,

    input_type: "department_select",

  },

  {

    id: "condition",

    enabled: true,

    label: "Asset condition",

    order: 90,

    input_type: "select",

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

    input_type: "zone_select",

  },

  {

    id: "assigned_user_id",

    enabled: true,

    label: "Assigned worker",

    order: 110,

    input_type: "worker_select",

  },

  {

    id: "linked_tool_id",

    enabled: true,

    label: "Linked asset",

    order: 120,

    col_span: 2,

    input_type: "asset_select",

  },

  {

    id: "vendor",

    enabled: true,

    label: "Vendor (optional)",

    order: 130,

    input_type: "text",

    placeholder: "Supplier or manufacturer",

  },

  {

    id: "unit_cost",

    enabled: true,

    label: "Unit cost (optional)",

    order: 140,

    input_type: "number",

  },

  {

    id: "reorder_flag",

    enabled: true,

    label: "Flag for reorder",

    order: 150,

    input_type: "checkbox",

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



export function isBuiltinFieldId(id: string): id is InventoryBuiltinFieldId {

  return BUILTIN_FIELD_IDS.has(id);

}



/** Built-in fields that can switch between free-text input and a configured dropdown. */
export function canToggleFieldInputType(field: InventoryRegisterFieldConfig): boolean {
  if (field.is_custom) return true;
  if (!isBuiltinFieldId(field.id)) return false;
  const defaultType = DEFAULT_INPUT_TYPES[field.id];
  return defaultType === "text" || defaultType === "select";
}



export function effectiveInputType(field: InventoryRegisterFieldConfig): InventoryFieldInputType {

  if (field.input_type) return field.input_type;

  if (field.is_custom) return "text";

  if (isBuiltinFieldId(field.id)) return DEFAULT_INPUT_TYPES[field.id];

  return "text";

}



function normalizeField(field: InventoryRegisterFieldConfig, base?: InventoryRegisterFieldConfig): InventoryRegisterFieldConfig {

  const input_type = field.input_type ?? base?.input_type ?? (field.is_custom ? "text" : DEFAULT_INPUT_TYPES[field.id as InventoryBuiltinFieldId] ?? "text");

  return {

    ...(base ?? {}),

    ...field,

    input_type,

    options: field.options?.length ? field.options : base?.options,

  };

}



export function mergeRegisterFormConfig(raw?: InventoryRegisterFormConfig | null): InventoryRegisterFormConfig {

  const defaultsById = new Map(DEFAULT_REGISTER_FORM_FIELDS.map((f) => [f.id, f]));

  const incoming = raw?.fields ?? [];

  const merged: InventoryRegisterFieldConfig[] = [];



  for (const field of incoming) {

    if (field.is_custom || !isBuiltinFieldId(field.id)) {

      merged.push(normalizeField(field));

      continue;

    }

    const base = defaultsById.get(field.id);

    if (!base) continue;

    merged.push(normalizeField(field, base));

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

  const hasLegacyConfig = Boolean(
    (Array.isArray(raw.categories) && raw.categories.length > 0) || raw.register_form?.fields?.length,
  );

  return {

    setup_completed: raw.setup_completed ?? hasLegacyConfig,

    register_form: mergeRegisterFormConfig(raw.register_form),

    status_rules: { ...DEFAULT_STATUS_RULES, ...raw.status_rules },

    threshold_defaults: { default_min: 5, ...raw.threshold_defaults },

    locations: [...(raw.locations ?? [])],

    assignment_rules: { checkout_required: true, ...raw.assignment_rules },

    alerts: { low_stock: true, missing: true, ...raw.alerts },

  };

}



export function registerFormCategoryFilterOptions(

  registerForm: InventoryRegisterFormConfig,

  itemCategories: string[],

): string[] {

  const categoryField = registerForm.fields.find((f) => f.id === "category" && f.enabled);

  const fromItems = itemCategories.map((c) => c.trim()).filter(Boolean);

  if (!categoryField) return [...new Set(fromItems)];

  if (effectiveInputType(categoryField) === "select" && categoryField.options?.length) {

    const fromOpts = categoryField.options.map((o) => o.label || o.value);

    return [...new Set([...fromOpts, ...fromItems])];

  }

  return [...new Set(fromItems)];

}



export function enabledRegisterFields(config: InventoryRegisterFormConfig): InventoryRegisterFieldConfig[] {

  return config.fields.filter((f) => f.enabled).sort((a, b) => a.order - b.order);

}



export function settingsPayloadFromMerged(merged: MergedInventorySettings): InventoryModuleSettings {

  return {

    setup_completed: merged.setup_completed,

    register_form: merged.register_form,

    status_rules: merged.status_rules,

    threshold_defaults: merged.threshold_defaults,

    locations: merged.locations,

    assignment_rules: merged.assignment_rules,

    alerts: merged.alerts,

  };

}



export function newCustomFieldDraft(label = "Custom field"): InventoryRegisterFieldConfig {

  const trimmed = label.trim() || "Custom field";

  const maxOrder = DEFAULT_REGISTER_FORM_FIELDS.reduce((m, f) => Math.max(m, f.order), 0);

  return {

    id: slugId(trimmed) ? `custom-${slugId(trimmed)}` : `custom-${Date.now()}`,

    enabled: true,

    label: trimmed,

    required: false,

    order: maxOrder + 10,

    input_type: "text",

    is_custom: true,

  };

}



export function nextFieldOrder(fields: InventoryRegisterFieldConfig[]): number {

  if (!fields.length) return 10;

  return Math.max(...fields.map((f) => f.order)) + 10;

}


