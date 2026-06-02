import { apiFetch } from "@/lib/api";
import { fetchInventorySettings } from "@/lib/inventoryService";
import type { InventoryScanProduct } from "@/lib/inventory-scanner/inventoryScannerService";
import { mergeInventoryModuleSettings, type MergedInventorySettings } from "@/lib/inventory/register-form-config";
import {
  DEFAULT_TRANSACTION_SETTINGS,
  mergeTransactionSettings,
  type InventoryTransactionSettings,
} from "@/lib/inventory/transactions/settings";
import type { TransactionCartLine, TransactionLineResult, TransactionMode, TransactionReference } from "./types";

export type { InventoryTransactionSettings };

export async function fetchInventoryTransactionSettings(): Promise<InventoryTransactionSettings> {
  try {
    const out = await apiFetch<InventoryTransactionSettings>("/api/inventory/scan/transaction-settings");
    return { ...DEFAULT_TRANSACTION_SETTINGS, ...out };
  } catch {
    const row = await fetchInventorySettings(null);
    return mergeTransactionSettings(mergeInventoryModuleSettings(row.settings ?? {}));
  }
}

export async function commitInventoryTransactionBatch(
  mode: TransactionMode,
  lines: TransactionCartLine[],
  batchReference: TransactionReference | null,
  settings: InventoryTransactionSettings,
): Promise<{ lines: TransactionLineResult[] }> {
  const body = {
    transaction_type: mode,
    lines: lines.map((line) => ({
      item_id: line.product.id,
      quantity: line.quantity,
      location_id: settings.enable_location_selection ? line.location_id : null,
      reference:
        settings.enable_references && line.reference && hasReference(line.reference)
          ? line.reference
          : undefined,
    })),
    reference:
      settings.enable_references && batchReference && hasReference(batchReference)
        ? batchReference
        : undefined,
  };
  return apiFetch("/api/inventory/scan/transactions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function commitInventoryTransactionSingle(
  mode: TransactionMode,
  product: InventoryScanProduct,
  quantity: number,
  locationId: string | null,
  reference: TransactionReference | null,
  settings: InventoryTransactionSettings,
): Promise<{ product: InventoryScanProduct; quantity_after: number }> {
  const result = await apiFetch<{
    item: InventoryScanProduct;
    quantity_after: number;
  }>("/api/inventory/scan/transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sku: product.sku,
      action: mode,
      quantity,
      location_id: settings.enable_location_selection ? locationId : undefined,
      reference_type: settings.enable_references ? reference?.reference_type || undefined : undefined,
      reference_id: settings.enable_references ? reference?.reference_id || undefined : undefined,
      reference_note: settings.enable_references ? reference?.reference_note || undefined : undefined,
    }),
  });
  return { product: result.item, quantity_after: result.quantity_after };
}

function hasReference(ref: TransactionReference): boolean {
  return Boolean(ref.reference_type.trim() || ref.reference_id.trim() || ref.reference_note.trim());
}

/** Extend module settings type for editors */
export type InventoryModuleSettingsWithTransactions = MergedInventorySettings & {
  transactions?: Partial<InventoryTransactionSettings>;
};
