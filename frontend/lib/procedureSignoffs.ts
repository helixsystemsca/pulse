export type ProcedureSignoff = {
  procedure_id: string;
  procedure_title: string;
  /** ISO timestamp when worker/supervisor signed off completion. */
  completed_at: string;
  /** Optional: supervisor id/name for audit context (local-only for now). */
  completed_by_user_id?: string | null;
  completed_by_name?: string | null;
  /** Optional: revision marker (approx until backend provides). */
  revision_marker?: string | null;
};

function keyForUser(userId: string) {
  return `procedure_signoffs_v1:${userId}`;
}

export function listProcedureSignoffs(userId: string): ProcedureSignoff[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cleaned: ProcedureSignoff[] = [];
    for (const it of parsed) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      if (typeof o.procedure_id !== "string" || typeof o.procedure_title !== "string" || typeof o.completed_at !== "string")
        continue;
      cleaned.push({
        procedure_id: o.procedure_id,
        procedure_title: o.procedure_title,
        completed_at: o.completed_at,
        completed_by_user_id: typeof o.completed_by_user_id === "string" ? o.completed_by_user_id : null,
        completed_by_name: typeof o.completed_by_name === "string" ? o.completed_by_name : null,
        revision_marker: typeof o.revision_marker === "string" ? o.revision_marker : null,
      });
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function hasSignedOffProcedure(userId: string, procedureId: string): boolean {
  return listProcedureSignoffs(userId).some((a) => a.procedure_id === procedureId);
}

export function signoffProcedure(
  userId: string,
  procedureId: string,
  procedureTitle: string,
  meta?: { completed_by_user_id?: string | null; completed_by_name?: string | null; revision_marker?: string | null },
): ProcedureSignoff {
  const nowIso = new Date().toISOString();
  const next: ProcedureSignoff = {
    procedure_id: procedureId,
    procedure_title: (procedureTitle || "Procedure").slice(0, 160),
    completed_at: nowIso,
    completed_by_user_id: meta?.completed_by_user_id ?? null,
    completed_by_name: meta?.completed_by_name ?? null,
    revision_marker: meta?.revision_marker ?? null,
  };
  if (typeof window === "undefined") return next;
  const prev = listProcedureSignoffs(userId);
  const merged = [next, ...prev.filter((a) => a.procedure_id !== procedureId)];
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(merged.slice(0, 800)));
  return next;
}

