export type ProcedureAcknowledgment = {
  procedure_id: string;
  procedure_title: string;
  /** ISO timestamp when user acknowledged reading. */
  signed_at: string;
};

function keyForUser(userId: string) {
  return `procedure_acks_v1:${userId}`;
}

export function listProcedureAcknowledgments(userId: string): ProcedureAcknowledgment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(keyForUser(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const cleaned: ProcedureAcknowledgment[] = [];
    for (const it of parsed) {
      if (!it || typeof it !== "object") continue;
      const o = it as Record<string, unknown>;
      if (typeof o.procedure_id !== "string" || typeof o.procedure_title !== "string" || typeof o.signed_at !== "string")
        continue;
      cleaned.push({
        procedure_id: o.procedure_id,
        procedure_title: o.procedure_title,
        signed_at: o.signed_at,
      });
    }
    return cleaned;
  } catch {
    return [];
  }
}

export function hasAcknowledgedProcedure(userId: string, procedureId: string): boolean {
  return listProcedureAcknowledgments(userId).some((a) => a.procedure_id === procedureId);
}

export function acknowledgeProcedure(userId: string, procedureId: string, procedureTitle: string): ProcedureAcknowledgment {
  const nowIso = new Date().toISOString();
  const next: ProcedureAcknowledgment = {
    procedure_id: procedureId,
    procedure_title: (procedureTitle || "Procedure").slice(0, 160),
    signed_at: nowIso,
  };
  if (typeof window === "undefined") return next;
  const prev = listProcedureAcknowledgments(userId);
  const merged = [next, ...prev.filter((a) => a.procedure_id !== procedureId)];
  window.localStorage.setItem(keyForUser(userId), JSON.stringify(merged.slice(0, 500)));
  return next;
}

