import {
  ARENA_ROUTINE_TEMPLATES,
  parseArenaRoutineName,
  type ArenaRoutineTemplate,
} from "@/lib/schedule/arena-routine-catalog";
import {
  createRoutine,
  getRoutine,
  listRoutines,
  patchRoutine,
  type RoutineItemIn,
  type RoutineRow,
} from "@/lib/routinesService";

export type EnsureArenaRoutinesResult = {
  created: string[];
  updated: string[];
  renamed: string[];
  skipped: string[];
};

function templateItems(template: ArenaRoutineTemplate): RoutineItemIn[] {
  return template.items.map((it, i) => ({ ...it, position: i }));
}

function findLegacyNightRoutine(
  rows: RoutineRow[],
  side: "a" | "b",
): RoutineRow | undefined {
  const label = side === "a" ? "Arena A" : "Arena B";
  return rows.find((r) => {
    const parsed = parseArenaRoutineName(r.name);
    if (parsed.side !== side) return false;
    if (parsed.kind === "extra") return false;
    const bare = r.name.trim().toLowerCase() === label.toLowerCase();
    const legacyNight =
      parsed.shiftBand === "night" &&
      !/\b(day|afternoon)\b/i.test(r.name) &&
      !/—|–|-/.test(r.name);
    return bare || legacyNight;
  });
}

async function upsertTemplate(
  rows: RoutineRow[],
  template: ArenaRoutineTemplate,
): Promise<"created" | "updated" | "renamed" | "skipped"> {
  let existing = rows.find(
    (r) => r.name.trim().toLowerCase() === template.name.trim().toLowerCase(),
  );

  if (!existing && template.kind === "main" && template.shiftBand === "night") {
    const legacy = findLegacyNightRoutine(rows, template.side);
    if (legacy) {
      await patchRoutine(legacy.id, { name: template.name, items: templateItems(template) });
      return "renamed";
    }
  }

  if (!existing) {
    await createRoutine({ name: template.name, items: templateItems(template) });
    return "created";
  }

  const detail = await getRoutine(existing.id);
  const needsItems =
    detail.items.length === 0 ||
    (template.kind === "main" &&
      !detail.items.some((it) => it.shift_band === template.shiftBand));
  if (needsItems) {
    await patchRoutine(existing.id, { items: templateItems(template) });
    return "updated";
  }
  return "skipped";
}

/** Idempotently create Arena A/B routines for all shifts plus Extra variants. */
export async function ensureArenaRoutines(): Promise<EnsureArenaRoutinesResult> {
  const rows = await listRoutines();
  const result: EnsureArenaRoutinesResult = {
    created: [],
    updated: [],
    renamed: [],
    skipped: [],
  };

  for (const template of ARENA_ROUTINE_TEMPLATES) {
    const status = await upsertTemplate(rows, template);
    if (status === "created") result.created.push(template.name);
    else if (status === "updated") result.updated.push(template.name);
    else if (status === "renamed") result.renamed.push(template.name);
    else result.skipped.push(template.name);
  }

  return result;
}
