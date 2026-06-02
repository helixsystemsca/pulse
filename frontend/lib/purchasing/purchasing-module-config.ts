import type { InventoryModuleSettings } from "@/lib/inventoryService";

export type PurchasingModuleConfig = {
  enabled: boolean;
  enable_replenishment_requests: boolean;
  enable_quick_purchases: boolean;
  enable_receipt_uploads: boolean;
  enable_vendor_tracking: boolean;
  enable_contract_archive: boolean;
  enable_purchase_history: boolean;
  enable_monthly_expense_exports: boolean;
  require_vendor_selection: boolean;
  require_receipt_upload: boolean;
  purchasing_label: string;
  replenishment_label: string;
};

export const DEFAULT_PURCHASING_CONFIG: PurchasingModuleConfig = {
  enabled: true,
  enable_replenishment_requests: true,
  enable_quick_purchases: true,
  enable_receipt_uploads: true,
  enable_vendor_tracking: true,
  enable_contract_archive: false,
  enable_purchase_history: true,
  enable_monthly_expense_exports: true,
  require_vendor_selection: false,
  require_receipt_upload: false,
  purchasing_label: "Purchasing",
  replenishment_label: "Replenishment Queue",
};

export type PurchasingAcquisitionMode = "replenishment" | "quick" | "both";

export function mergePurchasingConfig(raw: InventoryModuleSettings = {}): PurchasingModuleConfig {
  const p = raw.purchasing as Partial<PurchasingModuleConfig> | undefined;
  const out = { ...DEFAULT_PURCHASING_CONFIG, ...p };
  out.purchasing_label = (out.purchasing_label || DEFAULT_PURCHASING_CONFIG.purchasing_label).trim();
  out.replenishment_label = (out.replenishment_label || DEFAULT_PURCHASING_CONFIG.replenishment_label).trim();
  if (!out.enable_replenishment_requests && !out.enable_quick_purchases) {
    out.enable_quick_purchases = true;
  }
  return out;
}

export function purchasingBlockForSave(config: PurchasingModuleConfig): InventoryModuleSettings["purchasing"] {
  return { ...config };
}

export type PurchasingWizardStepId =
  | "Purchasing — How you buy"
  | "Purchasing — Vendors"
  | "Purchasing — Receipts"
  | "Purchasing — Exports"
  | "Purchasing — Module name";

export function validatePurchasingWizardStep(
  step: PurchasingWizardStepId,
  config: PurchasingModuleConfig,
): string | null {
  switch (step) {
    case "Purchasing — How you buy":
      if (!config.enable_replenishment_requests && !config.enable_quick_purchases) {
        return "Select at least one way your organization acquires materials.";
      }
      return null;
    case "Purchasing — Module name":
      if (!config.purchasing_label.trim()) return "Enter a module name.";
      return null;
    default:
      return null;
  }
}

export function purchasingNavItems(config: PurchasingModuleConfig): { id: string; label: string }[] {
  if (!config.enabled) return [];
  const items: { id: string; label: string }[] = [];
  if (config.enable_replenishment_requests) {
    items.push({ id: "replenishment", label: config.replenishment_label });
  }
  if (config.enable_quick_purchases) {
    items.push({ id: "quick", label: "Quick Purchases" });
  }
  if (config.enable_vendor_tracking) {
    items.push({ id: "vendors", label: "Vendors" });
  }
  if (config.enable_receipt_uploads) {
    items.push({ id: "receipts", label: "Receipts" });
  }
  if (config.enable_purchase_history) {
    items.push({ id: "history", label: "History" });
  }
  return items;
}
