import {
  isArenaExtraRoutineName,
  isArenaRoutineName,
  parseArenaRoutineName,
} from "@/lib/schedule/arena-routine-catalog";
import type { RoutineRow, RoutineShiftBand } from "@/lib/routinesService";

export type ArenaRoutineGroups = {
  byShift: Record<RoutineShiftBand, RoutineRow[]>;
  extras: RoutineRow[];
  other: RoutineRow[];
};

const SHIFT_ORDER: RoutineShiftBand[] = ["day", "afternoon", "night"];

export function groupArenaRoutines(rows: RoutineRow[]): ArenaRoutineGroups {
  const byShift: Record<RoutineShiftBand, RoutineRow[]> = {
    day: [],
    afternoon: [],
    night: [],
  };
  const extras: RoutineRow[] = [];
  const other: RoutineRow[] = [];

  for (const r of rows) {
    if (!isArenaRoutineName(r.name)) {
      other.push(r);
      continue;
    }
    if (isArenaExtraRoutineName(r.name)) {
      extras.push(r);
      continue;
    }
    const parsed = parseArenaRoutineName(r.name);
    const band = parsed.shiftBand ?? "night";
    byShift[band].push(r);
  }

  for (const band of SHIFT_ORDER) {
    byShift[band].sort((a, b) => a.name.localeCompare(b.name));
  }
  extras.sort((a, b) => a.name.localeCompare(b.name));
  other.sort((a, b) => a.name.localeCompare(b.name));

  return { byShift, extras, other };
}

export const ARENA_SHIFT_SECTION_LABELS: Record<RoutineShiftBand, string> = {
  day: "Day shift",
  afternoon: "Afternoon shift",
  night: "Night shift",
};
