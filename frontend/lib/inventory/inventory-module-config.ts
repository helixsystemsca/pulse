/**
 * Tenant inventory operational config (wizard + module settings).
 * Stored under `settings.inventory` in inventory module settings JSON.
 */

import type { InventoryModuleSettings } from "@/lib/inventoryService";
import type { InventoryTransactionSettingsConfig } from "@/lib/inventory/register-form-config";

export type InventoryAssetType = "consumables" | "tools" | "equipment" | "materials" | "other";

export type InventoryLocationMode = "single" | "rooms" | "buildings" | "seacans" | "custom";

export type InventoryProcurementMode =
  | "shopping_list"
  | "excel"
  | "email"
  | "erp"
  | "manual";

export type InventoryReferenceMode = "none" | "optional" | "required";

export type InventoryApprovalMode = "none" | "single" | "multi";

export type InventoryModuleConfig = {
  asset_types: InventoryAssetType[];
  location_mode: InventoryLocationMode;
  procurement_mode: InventoryProcurementMode;
  procurement_action_label: string;
  reference_mode: InventoryReferenceMode;
  approval_mode: InventoryApprovalMode;
};

export const DEFAULT_INVENTORY_MODULE_CONFIG: InventoryModuleConfig = {
  asset_types: ["consumables", "tools", "materials"],
  location_mode: "single",
  procurement_mode: "excel",
  procurement_action_label: "Export Request",
  reference_mode: "none",
  approval_mode: "none",
};

export const ASSET_TYPE_OPTIONS: { value: InventoryAssetType; label: string }[] = [
  { value: "consumables", label: "Consumables" },
  { value: "tools", label: "Tools" },
  { value: "equipment", label: "Equipment" },
  { value: "materials", label: "Materials" },
  { value: "other", label: "Other" },
];

export const LOCATION_MODE_OPTIONS: { value: InventoryLocationMode; label: string; description?: string }[] = [
  { value: "single", label: "Single Location" },
  { value: "rooms", label: "Multiple Rooms" },
  { value: "buildings", label: "Multiple Buildings" },
  { value: "seacans", label: "Warehouses / Seacans" },
  { value: "custom", label: "Custom Hierarchy" },
];

export const PROCUREMENT_MODE_OPTIONS: { value: InventoryProcurementMode; label: string }[] = [
  { value: "shopping_list", label: "Shopping List" },
  { value: "excel", label: "Excel Export" },
  { value: "email", label: "Email Request" },
  { value: "erp", label: "External ERP" },
  { value: "manual", label: "Manual Process" },
];

export const REFERENCE_MODE_OPTIONS: { value: InventoryReferenceMode; label: string }[] = [
  { value: "none", label: "No References" },
  { value: "optional", label: "Optional References" },
  { value: "required", label: "Required References" },
];

export const APPROVAL_MODE_OPTIONS: { value: InventoryApprovalMode; label: string }[] = [
  { value: "none", label: "No Approval" },
  { value: "single", label: "Single Approval" },
  { value: "multi", label: "Multi-Step Approval" },
];

const ASSET_TYPE_SET = new Set<string>(ASSET_TYPE_OPTIONS.map((o) => o.value));
const LOCATION_SET = new Set<string>(LOCATION_MODE_OPTIONS.map((o) => o.value));
const PROCUREMENT_SET = new Set<string>(PROCUREMENT_MODE_OPTIONS.map((o) => o.value));
const REFERENCE_SET = new Set<string>(REFERENCE_MODE_OPTIONS.map((o) => o.value));
const APPROVAL_SET = new Set<string>(APPROVAL_MODE_OPTIONS.map((o) => o.value));

export function referenceModeFromTransactions(t: InventoryTransactionSettingsConfig): InventoryReferenceMode {
  if (!t.enable_references) return "none";
  if (t.require_reference) return "required";
  return "optional";
}

export function transactionsFromReferenceMode(
  mode: InventoryReferenceMode,
  base?: InventoryTransactionSettingsConfig,
): InventoryTransactionSettingsConfig {
  const prev = base ?? {
    require_reference: false,
    enable_references: false,
    enable_batch_transactions: true,
    enable_location_selection: true,
  };
  switch (mode) {
    case "none":
      return { ...prev, enable_references: false, require_reference: false };
    case "optional":
      return { ...prev, enable_references: true, require_reference: false };
    case "required":
      return { ...prev, enable_references: true, require_reference: true };
    default:
      return prev;
  }
}

export function locationSelectionFromMode(mode: InventoryLocationMode): boolean {
  return mode !== "single";
}

export function mergeInventoryModuleConfig(
  raw: Partial<InventoryModuleConfig> | undefined,
  legacyTransactions?: Partial<InventoryTransactionSettingsConfig>,
): InventoryModuleConfig {
  const base = { ...DEFAULT_INVENTORY_MODULE_CONFIG };
  if (raw?.asset_types?.length) {
    base.asset_types = raw.asset_types.filter((t): t is InventoryAssetType => ASSET_TYPE_SET.has(t));
  }
  if (raw?.location_mode && LOCATION_SET.has(raw.location_mode)) {
    base.location_mode = raw.location_mode;
  }
  if (raw?.procurement_mode && PROCUREMENT_SET.has(raw.procurement_mode)) {
    base.procurement_mode = raw.procurement_mode;
  }
  if (raw?.procurement_action_label?.trim()) {
    base.procurement_action_label = raw.procurement_action_label.trim();
  }
  if (raw?.reference_mode && REFERENCE_SET.has(raw.reference_mode)) {
    base.reference_mode = raw.reference_mode;
  } else if (legacyTransactions) {
    base.reference_mode = referenceModeFromTransactions({
      require_reference: Boolean(legacyTransactions.require_reference),
      enable_references: Boolean(legacyTransactions.enable_references),
      enable_batch_transactions: legacyTransactions.enable_batch_transactions !== false,
      enable_location_selection: legacyTransactions.enable_location_selection !== false,
    });
  }
  if (raw?.approval_mode && APPROVAL_SET.has(raw.approval_mode)) {
    base.approval_mode = raw.approval_mode;
  }
  if (!base.asset_types.length) {
    base.asset_types = [...DEFAULT_INVENTORY_MODULE_CONFIG.asset_types];
  }
  return base;
}

export function inventoryConfigLabel(
  key: keyof InventoryModuleConfig,
  value: InventoryModuleConfig[keyof InventoryModuleConfig],
): string {
  if (key === "asset_types" && Array.isArray(value)) {
    return (value as InventoryAssetType[])
      .map((v) => ASSET_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  if (key === "location_mode") {
    return LOCATION_MODE_OPTIONS.find((o) => o.value === value)?.label ?? String(value);
  }
  if (key === "procurement_mode") {
    return PROCUREMENT_MODE_OPTIONS.find((o) => o.value === value)?.label ?? String(value);
  }
  if (key === "reference_mode") {
    return REFERENCE_MODE_OPTIONS.find((o) => o.value === value)?.label ?? String(value);
  }
  if (key === "approval_mode") {
    return APPROVAL_MODE_OPTIONS.find((o) => o.value === value)?.label ?? String(value);
  }
  if (key === "procurement_action_label") {
    return String(value || DEFAULT_INVENTORY_MODULE_CONFIG.procurement_action_label);
  }
  return String(value);
}

export type InventoryWizardStepId =
  | "Welcome"
  | "Inventory Structure"
  | "Storage Locations"
  | "Procurement Workflow"
  | "Procurement Terminology"
  | "Transaction References"
  | "Approval Workflow"
  | "Register form"
  | "Review";

export function validateInventoryWizardStep(
  step: InventoryWizardStepId,
  inventory: InventoryModuleConfig,
): string | null {
  switch (step) {
    case "Inventory Structure":
      if (!inventory.asset_types.length) return "Select at least one asset type to track.";
      return null;
    case "Storage Locations":
      if (!LOCATION_SET.has(inventory.location_mode)) return "Choose how inventory is organized.";
      return null;
    case "Procurement Workflow":
      if (!PROCUREMENT_SET.has(inventory.procurement_mode)) return "Choose a procurement workflow.";
      return null;
    case "Procurement Terminology":
      if (!inventory.procurement_action_label.trim()) return "Enter a label for the procurement action.";
      return null;
    case "Transaction References":
      if (!REFERENCE_SET.has(inventory.reference_mode)) return "Choose how transaction references work.";
      return null;
    case "Approval Workflow":
      if (!APPROVAL_SET.has(inventory.approval_mode)) return "Choose an approval workflow.";
      return null;
    default:
      return null;
  }
}

export function inventoryConfigFromModuleSettings(
  raw: InventoryModuleSettings = {},
): InventoryModuleConfig {
  const inv = raw.inventory as Partial<InventoryModuleConfig> | undefined;
  return mergeInventoryModuleConfig(inv, raw.transactions);
}

export function inventoryBlockForModuleSettings(
  config: InventoryModuleConfig,
): InventoryModuleSettings["inventory"] {
  return { ...config };
}
