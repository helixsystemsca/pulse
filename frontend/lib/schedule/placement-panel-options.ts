import type {
  PlacementBandOption,
  SchedulePlacementBand,
  ScheduleRoleDefinition,
  ScheduleSettings,
} from "@/lib/schedule/types";

export const DEFAULT_PLACEMENT_BAND_OPTIONS: PlacementBandOption[] = [
  { band: "template", label: "Match worker template", enabled: true },
  { band: "day", label: "Day · 07:00–15:00", enabled: true },
  { band: "afternoon", label: "Afternoon · 14:00–22:00", enabled: true },
  { band: "night", label: "Night · 22:00–06:00", enabled: true },
];

const ALLOWED_BANDS = new Set<SchedulePlacementBand>(["template", "day", "afternoon", "night"]);

function defaultLabelForBand(band: SchedulePlacementBand): string {
  return DEFAULT_PLACEMENT_BAND_OPTIONS.find((x) => x.band === band)?.label ?? band;
}

/**
 * Normalized band rows (order + labels). Falls back to defaults when unset or invalid.
 */
export function resolvePlacementBandOptions(settings: ScheduleSettings): PlacementBandOption[] {
  const raw = settings.placementBandOptions;
  if (!raw?.length) return DEFAULT_PLACEMENT_BAND_OPTIONS.map((o) => ({ ...o }));
  const cleaned = raw.filter((o) => ALLOWED_BANDS.has(o.band));
  if (!cleaned.length) return DEFAULT_PLACEMENT_BAND_OPTIONS.map((o) => ({ ...o }));
  return cleaned.map((o) => ({
    band: o.band,
    label: (o.label || "").trim() || defaultLabelForBand(o.band),
    enabled: o.enabled !== false,
  }));
}

/** Entries that should appear in the dropdown. */
export function placementBandDropdownOptions(settings: ScheduleSettings): PlacementBandOption[] {
  return resolvePlacementBandOptions(settings).filter((o) => o.enabled !== false);
}

export function placementBandChoicesKey(settings: ScheduleSettings): string {
  return placementBandDropdownOptions(settings)
    .map((o) => o.band)
    .join(",");
}

/** Roles listed in “Role when placing”, in order. Empty / undefined => all roles in store order. */
export function resolvePlacementRoles(
  roles: ScheduleRoleDefinition[],
  placementPanelRoleIds: string[] | undefined,
): ScheduleRoleDefinition[] {
  if (!placementPanelRoleIds?.length) return roles;
  const map = new Map(roles.map((r) => [r.id, r]));
  const ordered = placementPanelRoleIds.map((id) => map.get(id)).filter(Boolean) as ScheduleRoleDefinition[];
  return ordered.length ? ordered : roles;
}
