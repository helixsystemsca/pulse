/** Pulse zones used for inventory storage (excludes workforce schedule facilities). */

export type ZoneMeta = { schedule_facility?: boolean; inventory_location?: boolean; [key: string]: unknown };

export type ZoneWithMeta = { id: string; name: string; meta?: ZoneMeta | null };

export function isScheduleFacilityZone(zone: ZoneWithMeta): boolean {
  return zone.meta?.schedule_facility === true;
}

/** Inventory locations — not auto-seeded schedule facilities (`Facility 1`, etc.). */
export function filterInventoryStorageZones<T extends ZoneWithMeta>(zones: T[]): T[] {
  return zones.filter((z) => !isScheduleFacilityZone(z));
}
