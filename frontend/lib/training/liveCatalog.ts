import type { ProcedureRow } from "@/lib/cmmsApi";
import type { WorkerRow } from "@/lib/workersService";
import type { TrainingEmployee, TrainingProgram } from "./types";
import { configForProcedure, type ProcedureComplianceConfigMap } from "./procedureComplianceConfig";

export function workersToTrainingEmployees(workers: WorkerRow[]): TrainingEmployee[] {
  return workers
    .filter((w) => w.is_active)
    .map((w) => ({
      id: w.id,
      display_name: (w.full_name?.trim() || w.email || "Employee").slice(0, 120),
      department: w.department?.trim() || "—",
    }))
    .sort((a, b) => a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" }));
}

function procedureRevisionNumber(p: ProcedureRow): number {
  if (typeof p.content_revision === "number" && Number.isFinite(p.content_revision)) {
    return Math.max(1, Math.round(p.content_revision));
  }
  return p.revised_at ? 2 : 1;
}

function procedureRevisionDate(p: ProcedureRow): string {
  const iso = (p.published_at ?? p.revised_at ?? p.updated_at ?? p.created_at ?? "").slice(0, 10);
  return iso || new Date().toISOString().slice(0, 10);
}

export function proceduresToTrainingPrograms(
  procedures: ProcedureRow[],
  configMap: ProcedureComplianceConfigMap,
): TrainingProgram[] {
  return (procedures ?? [])
    .map((p) => {
      const cfg = configForProcedure(p.id, configMap);
      return {
        id: p.id,
        title: p.title,
        description: (p.search_keywords?.length ? p.search_keywords.join(", ") : "Standard operating procedure.").slice(
          0,
          160,
        ),
        tier: cfg.tier,
        category: "Procedure",
        revision_number: procedureRevisionNumber(p),
        revision_date: procedureRevisionDate(p),
        requires_acknowledgement: cfg.requires_acknowledgement,
        expiry_months: null,
        due_within_days: cfg.due_within_days,
        active: true,
      } satisfies TrainingProgram;
    })
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

