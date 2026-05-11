"use client";

import { apiFetch, isApiMode } from "@/lib/api";
import { canAccessPulseTenantApis, readSession } from "@/lib/pulse-session";
import { getServerNow } from "@/lib/serverTime";
import {
  buildOperationalNotificationItems,
  type OperationalNotificationItem,
} from "@/lib/dashboard/operational-notifications";

type DashboardPayload = {
  active_workers: number;
  open_work_requests: number;
  low_stock_items: number;
  shifts_today: number;
  alerts: string[];
};

type AssetOut = {
  id: string;
  name: string;
  zone_id: string | null;
  status: string;
};

type InventoryItemOut = {
  id: string;
  name: string;
  quantity: number;
  low_stock_threshold: number;
};

type ZoneOut = { id: string; name: string };

/**
 * Loads the same operational notification sources as the operations dashboard (minus schedule/workforce)
 * for the global header modal.
 */
export async function fetchOperationalNotificationsForHeader(): Promise<OperationalNotificationItem[] | null> {
  if (!isApiMode()) return null;
  const sess = readSession();
  if (!sess?.access_token || !canAccessPulseTenantApis(sess)) return null;

  try {
    const [dash, assetList, lowStock, zoneList] = await Promise.all([
      apiFetch<DashboardPayload>("/api/v1/pulse/dashboard"),
      apiFetch<AssetOut[]>("/api/v1/pulse/assets"),
      apiFetch<InventoryItemOut[]>("/api/v1/pulse/inventory/low-stock"),
      apiFetch<ZoneOut[]>("/api/v1/pulse/schedule-facilities"),
    ]);
    return buildOperationalNotificationItems({
      dashboard: dash,
      assets: assetList,
      lowStock,
      zones: zoneList,
      nowMs: getServerNow(),
    });
  } catch {
    return null;
  }
}
