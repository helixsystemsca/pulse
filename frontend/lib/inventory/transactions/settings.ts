import type { MergedInventorySettings } from "@/lib/inventory/register-form-config";

export type InventoryTransactionSettings = {
  require_reference: boolean;
  enable_references: boolean;
  enable_batch_transactions: boolean;
  enable_location_selection: boolean;
};

export const DEFAULT_TRANSACTION_SETTINGS: InventoryTransactionSettings = {
  require_reference: false,
  enable_references: false,
  enable_batch_transactions: true,
  enable_location_selection: true,
};

export function mergeTransactionSettings(raw: MergedInventorySettings): InventoryTransactionSettings {
  const t = raw.transactions as Partial<InventoryTransactionSettings> | undefined;
  return {
    require_reference: Boolean(t?.require_reference ?? DEFAULT_TRANSACTION_SETTINGS.require_reference),
    enable_references: Boolean(t?.enable_references ?? DEFAULT_TRANSACTION_SETTINGS.enable_references),
    enable_batch_transactions:
      t?.enable_batch_transactions !== undefined
        ? Boolean(t.enable_batch_transactions)
        : DEFAULT_TRANSACTION_SETTINGS.enable_batch_transactions,
    enable_location_selection:
      t?.enable_location_selection !== undefined
        ? Boolean(t.enable_location_selection)
        : DEFAULT_TRANSACTION_SETTINGS.enable_location_selection,
  };
}
