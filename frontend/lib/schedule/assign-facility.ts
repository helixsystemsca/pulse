/** Resolve facility for a new worker/palette assignment — never blindly prefer zones[0]. */

export function resolveScheduleAssignFacilityId(opts: {
  workerId: string;
  zones: Array<{ id: string }>;
  shifts: Array<{ workerId: string | null; zoneId: string; date: string }>;
  facilityFilterIds?: string[];
  homeFacilityId?: string | null;
}): string {
  const zoneIds = opts.zones.map((z) => z.id).filter(Boolean);
  const allowed = new Set(zoneIds);
  const filters = (opts.facilityFilterIds ?? []).filter((id) => allowed.has(id));
  const pool = filters.length ? filters : zoneIds;

  if (filters.length === 1) return filters[0]!;

  const home = opts.homeFacilityId?.trim() || "";
  if (home && pool.includes(home)) return home;

  const lastUsed = [...opts.shifts]
    .filter((s) => s.workerId === opts.workerId && s.zoneId && pool.includes(s.zoneId))
    .sort((a, b) => b.date.localeCompare(a.date))[0]?.zoneId;
  if (lastUsed) return lastUsed;

  return pool[0] ?? "";
}
