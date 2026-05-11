function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Roles omitted from the training overview role filter dropdown. */
const EXCLUDED_ROLE_FILTERS = new Set(["demo_viewer", "company_admin"]);

/** Title case words (handles `_` as word breaks). */
export function formatLabelTitleCase(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return t
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Display string for a worker role in training UI (table, filters, drawer). */
export function formatTrainingRoleDisplay(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  const n = norm(raw);
  if (n === "workers" || n === "worker") return "Operations";
  return formatLabelTitleCase(raw.replace(/_/g, " "));
}

/**
 * Role values for the training overview `<select>`: `all` plus sorted display labels.
 * Excludes `demo_viewer` and `company_admin` from the list (those users still appear when "All Roles" is selected).
 */
type WorkerMetaLike = { role: string; shift?: string | null };

export function rolesForTrainingDropdown(workerMeta: Record<string, WorkerMetaLike | undefined>): string[] {
  const seen = new Set<string>();
  for (const m of Object.values(workerMeta)) {
    if (!m) continue;
    const r = m.role?.trim();
    if (!r) continue;
    if (EXCLUDED_ROLE_FILTERS.has(norm(r))) continue;
    seen.add(formatTrainingRoleDisplay(r));
  }
  return ["all", ...[...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))];
}
