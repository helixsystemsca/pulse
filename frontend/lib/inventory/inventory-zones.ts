/** Pulse zones used for inventory storage (excludes workforce schedule facilities). */

import type { PulseAuthSession } from "@/lib/pulse-session";
import { isInventoryPrimaryTenant } from "@/lib/inventory/inventory-tenant-scope";

export type ZoneMeta = { schedule_facility?: boolean; inventory_location?: boolean; [key: string]: unknown };

export type ZoneWithMeta = { id: string; name: string; meta?: ZoneMeta | null };

export function isScheduleFacilityZone(zone: ZoneWithMeta): boolean {
  return zone.meta?.schedule_facility === true;
}

export function isInventoryStorageZone(zone: ZoneWithMeta): boolean {
  if (isScheduleFacilityZone(zone)) return false;
  if (zone.meta?.inventory_location === true) return true;
  const meta = zone.meta ?? {};
  return Object.keys(meta).length === 0;
}

export type FilterInventoryZonesOptions = {
  /** When true, only zones created for inventory (setup wizard / settings). */
  inventoryPrimary?: boolean;
  session?: PulseAuthSession | null;
};

/**
 * Locations shown in inventory UI.
 * - Inventory-only tenants: wizard/settings zones (`meta.inventory_location`).
 * - Full platform tenants: any zone except schedule facilities (`Facility 1`, etc.).
 */
export function filterInventoryStorageZones<T extends ZoneWithMeta>(
  zones: T[],
  options?: FilterInventoryZonesOptions,
): T[] {
  const inventoryPrimary =
    options?.inventoryPrimary ?? (options?.session ? isInventoryPrimaryTenant(options.session) : false);
  if (inventoryPrimary) {
    return zones.filter((z) => isInventoryStorageZone(z));
  }
  return zones.filter((z) => !isScheduleFacilityZone(z));
}
