import type { RoutineItemIn, RoutineShiftBand } from "@/lib/routinesService";

export type ArenaSide = "a" | "b";

export type ArenaRoutineTemplate = {
  name: string;
  side: ArenaSide;
  shiftBand: RoutineShiftBand;
  kind: "main" | "extra";
  items: Omit<RoutineItemIn, "position">[];
};

const MAIN_ITEMS: Record<RoutineShiftBand, string[]> = {
  day: [
    "Open change rooms and verify cleanliness",
    "Lobby and concourse walk-through",
    "Ice surface visual check before first program",
    "Staffing board and radio check",
  ],
  afternoon: [
    "Turnover between day and evening programs",
    "Concourse and seating area sweep",
    "Change room mid-shift check",
    "Coordinate with events for ice access windows",
  ],
  night: [
    "Night shift — close change rooms when programs end",
    "End-of-night ice and dasher board check",
    "Lock perimeter doors per checklist",
    "Night shift — handoff notes for morning crew",
  ],
};

function itemsForBand(band: RoutineShiftBand): Omit<RoutineItemIn, "position">[] {
  return MAIN_ITEMS[band].map((label) => ({
    label,
    required: true,
    shift_band: band,
  }));
}

const EXTRA_ITEMS: Omit<RoutineItemIn, "position">[] = [
  { label: "Cover assigned extra task (see assignment notes)", required: true },
  { label: "Confirm completion with supervisor", required: false },
];

function routineName(side: ArenaSide, band: RoutineShiftBand): string {
  const label = side === "a" ? "Arena A" : "Arena B";
  const shift =
    band === "day" ? "Day" : band === "afternoon" ? "Afternoon" : "Night";
  return `${label} — ${shift}`;
}

function extraRoutineName(side: ArenaSide): string {
  return side === "a" ? "Arena A — Extra" : "Arena B — Extra";
}

export const ARENA_ROUTINE_TEMPLATES: ArenaRoutineTemplate[] = (
  ["a", "b"] as ArenaSide[]
).flatMap((side) => [
  ...(["day", "afternoon", "night"] as RoutineShiftBand[]).map((shiftBand) => ({
    name: routineName(side, shiftBand),
    side,
    shiftBand,
    kind: "main" as const,
    items: itemsForBand(shiftBand),
  })),
  {
    name: extraRoutineName(side),
    side,
    shiftBand: "day" as RoutineShiftBand,
    kind: "extra" as const,
    items: EXTRA_ITEMS,
  },
]);

export type ParsedArenaRoutine = {
  side: ArenaSide | null;
  shiftBand: RoutineShiftBand | null;
  kind: "main" | "extra" | "unknown";
};

const NAME_RE =
  /^arena\s*([ab])\s*(?:—|-|:)?\s*(day|afternoon|night|extra)?/i;

export function parseArenaRoutineName(name: string): ParsedArenaRoutine {
  const m = name.trim().match(NAME_RE);
  if (!m) return { side: null, shiftBand: null, kind: "unknown" };
  const side = m[1]!.toLowerCase() as ArenaSide;
  const tail = (m[2] ?? "").toLowerCase();
  if (tail === "extra") return { side, shiftBand: null, kind: "extra" };
  const shiftBand = (tail || "night") as RoutineShiftBand;
  return { side, shiftBand, kind: "main" };
}

export function isArenaRoutineName(name: string): boolean {
  return parseArenaRoutineName(name).side !== null;
}

export function isArenaExtraRoutineName(name: string): boolean {
  return parseArenaRoutineName(name).kind === "extra";
}

export function arenaExtraRoutineNames(): string[] {
  return ARENA_ROUTINE_TEMPLATES.filter((t) => t.kind === "extra").map((t) => t.name);
}

export type ScheduleAssignmentAreaPreset = {
  area: string;
  notesByShift: Record<RoutineShiftBand, string>;
};

export const ARENA_SCHEDULE_ASSIGNMENT_PRESETS: ScheduleAssignmentAreaPreset[] = [
  {
    area: "Arena A",
    notesByShift: {
      day: "Day shift — open checks, lobby readiness, and ice surface before programs.",
      afternoon: "Afternoon shift — turnover between day and evening programs.",
      night: "Night shift — close change rooms, end-of-night ice checks, and perimeter lock-up.",
    },
  },
  {
    area: "Arena B",
    notesByShift: {
      day: "Day shift — B-side open checks and concourse readiness.",
      afternoon: "Afternoon shift — B-side turnover and event coordination.",
      night: "Night shift — B-side close-down, change rooms, and night handoff notes.",
    },
  },
];

export function scheduleAssignmentNoteForArea(
  area: string,
  shiftType: RoutineShiftBand,
): string | null {
  const preset = ARENA_SCHEDULE_ASSIGNMENT_PRESETS.find(
    (p) => p.area.localeCompare(area, undefined, { sensitivity: "base" }) === 0,
  );
  return preset?.notesByShift[shiftType] ?? null;
}
