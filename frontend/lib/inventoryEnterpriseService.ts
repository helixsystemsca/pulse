/**
 * Enterprise inventory APIs under `/api/inventory/{itemId}/…`
 */
import { apiFetch } from "@/lib/api";

export type InventoryForecast = {
  quantity: number;
  effective_threshold: number;
  consumption_per_day: number;
  days_until_stockout: number | null;
  lookback_days: number;
};

export type InventoryLifecycle = {
  acquired_on: string | null;
  acquisition_cost: number | null;
  useful_life_months: number | null;
  salvage_value: number | null;
  expected_retirement_on: string | null;
  disposed_on: string | null;
  disposal_method: string | null;
  disposal_notes: string | null;
  depreciation_method: string | null;
  book_value: number | null;
};

export type InventoryHistoryCard = {
  item: Record<string, unknown>;
  lifecycle: InventoryLifecycle;
  forecast: InventoryForecast;
  open_checkout: Record<string, unknown> | null;
  movements: Record<string, unknown>[];
  usage: Record<string, unknown>[];
  checkouts: Record<string, unknown>[];
};

function itemPath(itemId: string, suffix: string, companyId?: string | null) {
  const q = companyId ? `?company_id=${encodeURIComponent(companyId)}` : "";
  return `/api/inventory/${itemId}${suffix}${q}`;
}

export async function fetchInventoryHistoryCard(
  itemId: string,
  companyId?: string | null,
): Promise<InventoryHistoryCard> {
  return apiFetch<InventoryHistoryCard>(itemPath(itemId, "/history-card", companyId));
}

export async function fetchInventoryForecast(
  itemId: string,
  companyId?: string | null,
): Promise<InventoryForecast> {
  return apiFetch<InventoryForecast>(itemPath(itemId, "/forecast", companyId));
}

export async function fetchInventoryLifecycle(
  itemId: string,
  companyId?: string | null,
): Promise<InventoryLifecycle> {
  return apiFetch<InventoryLifecycle>(itemPath(itemId, "/lifecycle", companyId));
}

export async function patchInventoryLifecycle(
  itemId: string,
  body: Partial<InventoryLifecycle> & { vendor_id?: string | null },
  companyId?: string | null,
): Promise<InventoryLifecycle> {
  return apiFetch<InventoryLifecycle>(itemPath(itemId, "/lifecycle", companyId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function checkoutInventoryItem(
  itemId: string,
  body: { condition_out?: string; notes?: string; zone_id?: string },
  companyId?: string | null,
): Promise<{ checkout_id: string; checked_out_at: string }> {
  return apiFetch(itemPath(itemId, "/checkout", companyId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function checkinInventoryItem(
  itemId: string,
  body: { condition_in?: string; notes?: string },
  companyId?: string | null,
): Promise<{ checkout_id: string; checked_in_at: string | null }> {
  return apiFetch(itemPath(itemId, "/checkin", companyId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function fetchOpenCheckout(
  itemId: string,
  companyId?: string | null,
): Promise<{ open: boolean; checkout_id?: string; checked_out_by?: string }> {
  return apiFetch(itemPath(itemId, "/checkout/open", companyId));
}
