import type { RoutineItemRow, RoutineShiftBand } from "@/lib/routinesService";

export const ROUTINE_SHIFT_TABS: { id: RoutineShiftBand; label: string }[] = [
  { id: "day", label: "Days" },
  { id: "afternoon", label: "Afternoons" },
  { id: "night", label: "Nights" },
];

export function filterRoutineItemsForShiftBand<T extends Pick<RoutineItemRow, "shift_band">>(
  items: T[],
  band: string | null | undefined,
): T[] {
  if (!band) return items;
  const b = band.toLowerCase();
  return items.filter((i) => {
    const sb = i.shift_band;
    if (sb == null || String(sb).trim() === "") return true;
    return String(sb).toLowerCase() === b;
  });
}
