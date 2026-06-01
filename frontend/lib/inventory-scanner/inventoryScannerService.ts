import { apiFetch } from "@/lib/api";
import { fetchInventoryList, type InventoryRow } from "@/lib/inventoryService";

export type InventoryScanProduct = {
  id: string;
  sku: string;
  name: string;
  item_type: string;
  category: string | null;
  inv_status: string;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  location_name: string | null;
  image_url: string | null;
  department_slug: string;
};

export type InventoryScanTransactionResult = {
  item: InventoryScanProduct;
  action: "receive" | "issue";
  quantity_delta: number;
  quantity_before: number;
  quantity_after: number;
  movement_id: string;
  created_at: string;
};

export async function lookupInventoryBySku(sku: string): Promise<InventoryScanProduct> {
  const encoded = encodeURIComponent(sku.trim());
  return apiFetch<InventoryScanProduct>(`/api/inventory/scan/by-sku/${encoded}`);
}

function rowToScanProduct(row: InventoryRow): InventoryScanProduct {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    item_type: row.item_type,
    category: row.category,
    inv_status: row.inv_status,
    quantity: row.quantity,
    unit: row.unit,
    low_stock_threshold: row.low_stock_threshold,
    location_name: row.location_name,
    image_url: row.image_url ?? null,
    department_slug: row.department_slug,
  };
}

export async function searchInventoryProducts(
  query: string,
  limit = 8,
): Promise<InventoryScanProduct[]> {
  const q = query.trim();
  if (!q) return [];
  const res = await fetchInventoryList({ companyId: null, q, limit });
  return res.items.map(rowToScanProduct);
}

export async function fetchPopularInventoryProducts(limit = 6): Promise<InventoryScanProduct[]> {
  const res = await fetchInventoryList({ companyId: null, limit: 1 });
  const top = res.summary?.most_used ?? [];
  if (!top.length) return [];
  const rows = await Promise.all(
    top.slice(0, limit).map(async (entry) => {
      try {
        return await lookupInventoryBySku(entry.sku);
      } catch {
        return null;
      }
    }),
  );
  return rows.filter((r): r is InventoryScanProduct => r != null);
}

export async function resolveInventoryProduct(input: {
  sku?: string;
  id?: string;
  row?: InventoryScanProduct;
}): Promise<InventoryScanProduct> {
  if (input.row) {
    try {
      return await lookupInventoryBySku(input.row.sku);
    } catch {
      return input.row;
    }
  }
  if (input.sku?.trim()) return lookupInventoryBySku(input.sku);
  throw new Error("Product reference required");
}

export async function postInventoryScanTransaction(body: {
  sku: string;
  action: "receive" | "issue";
  quantity: number;
  notes?: string;
}): Promise<InventoryScanTransactionResult> {
  return apiFetch<InventoryScanTransactionResult>("/api/inventory/scan/transaction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
