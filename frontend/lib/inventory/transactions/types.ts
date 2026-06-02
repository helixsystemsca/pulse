import type { InventoryScanProduct } from "@/lib/inventory-scanner/inventoryScannerService";

export type TransactionMode = "issue" | "receive";

export type TransactionReference = {
  reference_type: string;
  reference_id: string;
  reference_note: string;
};

export type TransactionCartLine = {
  product: InventoryScanProduct;
  quantity: number;
  location_id: string | null;
  reference: TransactionReference | null;
};

export type TransactionLineResult = {
  item_id: string;
  sku: string;
  name: string;
  quantity: number;
  transaction_type: TransactionMode;
  location_id: string | null;
  location_name: string | null;
  quantity_before: number;
  quantity_after: number;
  movement_id: string;
};

export function emptyReference(): TransactionReference {
  return { reference_type: "", reference_id: "", reference_note: "" };
}

export function referenceFilled(ref: TransactionReference | null): boolean {
  if (!ref) return false;
  return Boolean(ref.reference_type.trim() || ref.reference_id.trim() || ref.reference_note.trim());
}
