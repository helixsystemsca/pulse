/**
 * Persists a Tailwind background class per project id for the schedule month/week top bar.
 * New projects get the next unused color from the pool, or a random pick when the pool is exhausted.
 */
const STORAGE_KEY = "pulse_project_schedule_tints";

const TINT_POOL = [
  "bg-rose-300/50 dark:bg-rose-500/28",
  "bg-amber-200/55 dark:bg-amber-500/28",
  "bg-emerald-300/45 dark:bg-emerald-500/26",
  "bg-sky-300/50 dark:bg-sky-500/28",
  "bg-violet-300/50 dark:bg-violet-500/28",
  "bg-fuchsia-300/45 dark:bg-fuchsia-500/26",
  "bg-lime-300/50 dark:bg-lime-500/25",
  "bg-cyan-300/50 dark:bg-cyan-500/26",
  "bg-orange-300/50 dark:bg-orange-500/28",
  "bg-pink-300/45 dark:bg-pink-500/26",
  "bg-indigo-300/50 dark:bg-indigo-500/28",
  "bg-teal-300/50 dark:bg-teal-500/26",
] as const;

function readMap(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as unknown;
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeMap(m: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
  } catch {
    /* quota / private mode */
  }
}

/** Returns a stable Tailwind class for this project; assigns a new color the first time we see an id. */
export function getOrAssignProjectTintClass(projectId: string): string {
  const map = readMap();
  if (map[projectId]) {
    return map[projectId]!;
  }
  const used = new Set(Object.values(map));
  const unused = TINT_POOL.find((c) => !used.has(c));
  const pick = unused ?? TINT_POOL[Math.floor(Math.random() * TINT_POOL.length)]!;
  map[projectId] = pick;
  writeMap(map);
  return pick;
}

export function projectTintClassForId(projectId: string): string {
  return getOrAssignProjectTintClass(projectId);
}
