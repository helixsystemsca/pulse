import type { InventoryDetail, InventoryRow } from "@/lib/inventoryService";
import type { InventoryRegisterFieldConfig, InventoryRegisterFormConfig } from "@/lib/inventory/register-form-config";
import {
  effectiveInputType,
  enabledRegisterFields,
  isBuiltinFieldId,
} from "@/lib/inventory/register-form-config";

/** Built-in fields always rendered in the item column (not separate table columns). */
export const ITEM_COLUMN_FIELD_IDS = new Set(["photo", "name", "sku"]);

/** Shown in the detail drawer header — not repeated in the details grid. */
const DETAIL_HEADER_FIELD_IDS = new Set(["name", "sku"]);

export function canConfigureTableColumn(field: InventoryRegisterFieldConfig): boolean {
  return Boolean(field.enabled) && !ITEM_COLUMN_FIELD_IDS.has(field.id);
}

const DEFAULT_SHOW_IN_TABLE: Partial<Record<string, boolean>> = {
  item_type: true,
  category: true,
  quantity: true,
  vendor: true,
  unit_cost: true,
  zone_id: true,
  department_slug: true,
};

export type InventoryTableColumnKind = "field" | "status" | "last_movement";

export type InventoryTableColumn =
  | { kind: "field"; field: InventoryRegisterFieldConfig; order: number }
  | { kind: "status"; label: string; order: number }
  | { kind: "last_movement"; label: string; order: number };

export function defaultShowInTable(field: InventoryRegisterFieldConfig): boolean {
  if (ITEM_COLUMN_FIELD_IDS.has(field.id)) return false;
  if (field.show_in_table != null) return field.show_in_table;
  if (field.is_custom) return false;
  return DEFAULT_SHOW_IN_TABLE[field.id] ?? false;
}

export function isRegisterFieldInTable(field: InventoryRegisterFieldConfig): boolean {
  return Boolean(field.enabled) && defaultShowInTable(field);
}

export function tableColumnsFromRegisterForm(config: InventoryRegisterFormConfig): InventoryTableColumn[] {
  const enabled = enabledRegisterFields(config);
  const tableFields = enabled.filter((f) => isRegisterFieldInTable(f));

  const columns: InventoryTableColumn[] = tableFields.map((field) => ({
    kind: "field",
    field,
    order: field.order,
  }));

  columns.sort((a, b) => a.order - b.order);

  const maxOrder = columns.length ? Math.max(...columns.map((c) => c.order)) : 0;
  columns.push({ kind: "status", label: "Status", order: maxOrder + 5 });
  columns.push({ kind: "last_movement", label: "Last movement", order: maxOrder + 10 });

  return columns;
}

/** Fields collected on the register form but not shown as table columns — show in item detail. */
export function detailFieldsFromRegisterForm(
  config: InventoryRegisterFormConfig,
): InventoryRegisterFieldConfig[] {
  return enabledRegisterFields(config).filter((f) => {
    if (f.id === "photo") return false;
    if (DETAIL_HEADER_FIELD_IDS.has(f.id)) return false;
    if (!f.enabled) return false;
    return !isRegisterFieldInTable(f);
  });
}

function labelForSelectOption(
  field: InventoryRegisterFieldConfig,
  value: string,
  fallback?: { value: string; label: string }[],
): string {
  const opts = field.options?.length ? field.options : (fallback ?? []);
  const hit = opts.find((o) => o.value === value);
  return hit?.label ?? value;
}

export function formatRegisterFieldValue(
  field: InventoryRegisterFieldConfig,
  row: InventoryRow | InventoryDetail,
  departmentNamesBySlug?: Record<string, string>,
): string {
  const inputType = effectiveInputType(field);

  if (field.is_custom || !isBuiltinFieldId(field.id)) {
    const raw = row.custom_attributes?.[field.id];
    if (inputType === "checkbox") return raw ? "Yes" : "No";
    if (raw == null || raw === "") return "—";
    return String(raw);
  }

  switch (field.id) {
    case "name":
      return row.name?.trim() || "—";
    case "sku":
      return row.sku?.trim() || "—";
    case "item_type":
      return row.item_type ? row.item_type.charAt(0).toUpperCase() + row.item_type.slice(1) : "—";
    case "category":
      return row.category?.trim() || "—";
    case "quantity":
      return row.item_type === "tool" ? "1 (tracked)" : `${row.quantity}`;
    case "unit":
      return row.unit?.trim() || "—";
    case "low_stock_threshold":
      return String(row.low_stock_threshold ?? "—");
    case "department_slug":
      return departmentNamesBySlug?.[row.department_slug ?? ""] ?? row.department_slug ?? "—";
    case "condition":
      return labelForSelectOption(field, row.condition, [
        { value: "good", label: "Good" },
        { value: "needs_maintenance", label: "Needs maintenance" },
        { value: "critical", label: "Critical / out of service" },
      ]);
    case "zone_id":
      return row.location_name?.trim() || "—";
    case "assigned_user_id":
      return row.assignee_name?.trim() || "Unassigned";
    case "linked_tool_id":
      return row.linked_asset_name?.trim() || "—";
    case "vendor":
      return row.vendor?.trim() || "—";
    case "unit_cost":
      return row.unit_cost != null && !Number.isNaN(Number(row.unit_cost))
        ? `$${Number(row.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : "—";
    case "reorder_flag":
      return row.reorder_flag ? "Yes" : "No";
    default:
      return "—";
  }
}
