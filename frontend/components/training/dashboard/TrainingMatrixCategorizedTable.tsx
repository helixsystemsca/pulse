"use client";

import { Search } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingEmployee,
  TrainingProgram,
} from "@/lib/training/types";
import { cellAssignmentStatus } from "@/lib/training/mockData";
import { assignmentFor } from "@/lib/training/selectors";
import { groupProgramsForMatrix, matrixCategoryForProgram } from "@/lib/training/dashboardMetrics";
import { TrainingMatrixCell } from "@/components/training/TrainingMatrixCell";
import { dataTableHeadRowClass } from "@/components/ui/DataTable";
import { dsInputClass } from "@/components/ui/ds-form-classes";
import { cn } from "@/lib/cn";

/** Procedure columns: fixed ~3/4" width so many columns fit without one stretching across the grid. */
const PROGRAM_COL_STYLE: CSSProperties = { width: "0.75in" };
const EMPLOYEE_COL_STYLE: CSSProperties = { width: "11rem" };

function verificationDetailTitle(
  a: TrainingAssignment | undefined,
  programRequiresKv: boolean,
): string | undefined {
  if (!a || !programRequiresKv) return undefined;
  const parts: string[] = [`Status: ${a.status.replace(/_/g, " ")}`];
  if (a.verification_last_viewed_at) {
    parts.push(`Last viewed: ${new Date(a.verification_last_viewed_at).toLocaleString()}`);
  }
  if ((a.quiz_attempt_count ?? 0) > 0) {
    parts.push(`Knowledge checks: ${a.quiz_attempt_count}`);
  }
  return parts.join("\n");
}

function sortPrograms(programs: TrainingProgram[]): TrainingProgram[] {
  const order = { mandatory: 0, high_risk: 1, general: 2 } as const;
  return [...programs].sort((a, b) => order[a.tier] - order[b.tier] || a.title.localeCompare(b.title));
}

const GROUP_LABEL: Record<ReturnType<typeof matrixCategoryForProgram>, string> = {
  mandatory: "Mandatory",
  equipment: "Equipment",
  seasonal: "Seasonal",
  general: "General",
};

export function TrainingMatrixCategorizedTable({
  employees,
  programs,
  assignments,
  acknowledgements,
  trustAssignmentStatus = false,
  statusColumnFilter = "all",
  matrixAdminCellEditable = false,
  onMatrixAdminCellCycle,
  matrixCycleBusyKey,
}: {
  employees: TrainingEmployee[];
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
  acknowledgements: TrainingAcknowledgement[];
  trustAssignmentStatus?: boolean;
  statusColumnFilter?: TrainingAssignmentStatus | "all";
  /** Company / tenant admin: click a cell to cycle matrix display override (default → complete → not complete → N/A → default). */
  matrixAdminCellEditable?: boolean;
  onMatrixAdminCellCycle?: (employeeId: string, programId: string) => void | Promise<void>;
  matrixCycleBusyKey?: string | null;
}) {
  const [kw, setKw] = useState("");

  const groups = useMemo(() => {
    const g = groupProgramsForMatrix(programs);
    const q = kw.trim().toLowerCase();
    if (!q) return g;
    return g
      .map((gr) => ({
        ...gr,
        programs: gr.programs.filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)),
      }))
      .filter((gr) => gr.programs.length > 0);
  }, [programs, kw]);

  const visiblePrograms = useMemo(() => groups.flatMap((g) => sortPrograms(g.programs)), [groups]);

  const tableWidthStyle = useMemo(
    () =>
      ({
        width: `max(100%, calc(11rem + ${visiblePrograms.length} * 0.75in))`,
      }) as CSSProperties,
    [visiblePrograms.length],
  );

  const stickyEmployeeTh =
    "sticky left-0 top-0 z-30 w-[11rem] min-w-[11rem] max-w-[11rem] shrink-0 overflow-hidden bg-white px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-[1px_0_0_var(--ds-border),0_1px_0_var(--ds-border)] dark:bg-slate-950 dark:text-slate-400";
  const stickyEmployeeCell =
    "sticky left-0 z-10 w-[11rem] min-w-[11rem] max-w-[11rem] shrink-0 overflow-hidden bg-white px-2 py-2 text-left font-semibold text-slate-900 shadow-[1px_0_0_var(--ds-border)] dark:bg-slate-950 dark:text-slate-50";
  const programHeadClass =
    "sticky top-0 z-20 w-[0.75in] min-w-[0.75in] max-w-[0.75in] overflow-hidden border-l border-slate-100 bg-ds-primary px-1.5 py-2 text-left align-bottom shadow-[0_1px_0_var(--ds-border)] dark:border-slate-800 dark:bg-slate-950";
  const programCellClass =
    "w-[0.75in] min-w-[0.75in] max-w-[0.75in] overflow-hidden border-l border-slate-50 px-1.5 py-1.5 align-middle dark:border-slate-800/80";

  return (
    <div className="space-y-3">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          className={cn(dsInputClass, "pl-9")}
          placeholder="Search procedures…"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          aria-label="Search training columns"
        />
      </div>

      <div className="ds-premium-panel relative min-h-0 min-w-0 max-h-[min(80vh,960px)] overflow-auto rounded-xl border border-slate-200/90 shadow-sm dark:border-slate-700/80 [-webkit-overflow-scrolling:touch]">
        <table className="table-fixed border-collapse text-sm" style={tableWidthStyle}>
          <colgroup>
            <col style={EMPLOYEE_COL_STYLE} />
            {visiblePrograms.map((p) => (
              <col key={p.id} style={PROGRAM_COL_STYLE} />
            ))}
          </colgroup>
          <thead>
            <tr className={dataTableHeadRowClass}>
              <th scope="col" className={stickyEmployeeTh}>
                Employee
              </th>
              {visiblePrograms.map((p) => (
                <th key={p.id} scope="col" className={programHeadClass}>
                  <div className="flex min-w-0 flex-col items-start gap-0.5">
                    <span className="text-[8px] font-bold uppercase leading-tight tracking-wide text-slate-400 dark:text-slate-500">
                      {GROUP_LABEL[matrixCategoryForProgram(p)]}
                    </span>
                    <span className="line-clamp-4 text-[10px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
                      {p.title}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={visiblePrograms.length + 1} className="px-3 py-8 text-center text-sm text-slate-500">
                  No employees match the current filters.
                </td>
              </tr>
            ) : (
              employees.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-950/40">
                  <th scope="row" className={stickyEmployeeCell}>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate" title={e.display_name}>
                        {e.display_name}
                      </span>
                      <span
                        className="truncate text-[10px] font-medium text-slate-500 dark:text-slate-400"
                        title={e.department}
                      >
                        {e.department}
                      </span>
                    </div>
                  </th>
                  {visiblePrograms.map((p) => {
                    const a = assignmentFor(e.id, p.id, assignments);
                    const eff = cellAssignmentStatus(p, a, acknowledgements, { trustAssignmentStatus });
                    const statusHidden = statusColumnFilter !== "all" && eff !== statusColumnFilter;
                    const mgrKvTitle =
                      trustAssignmentStatus && a
                        ? verificationDetailTitle(a, p.requires_knowledge_verification !== false)
                        : undefined;
                    const busyKey = `${e.id}:${p.id}`;
                    const cycleBusy = matrixCycleBusyKey === busyKey;
                    const override = a?.matrix_admin_override;
                    const adminTitle =
                      matrixAdminCellEditable && onMatrixAdminCellCycle
                        ? [
                            "Click to cycle display override (company admin).",
                            override === "force_complete"
                              ? "Currently: shown as complete."
                              : override === "force_incomplete"
                                ? "Currently: shown as not complete."
                                : override === "force_na"
                                  ? "Currently: shown as not applicable."
                                  : "Currently: default (computed) status.",
                            mgrKvTitle,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : mgrKvTitle;
                    return (
                      <td key={p.id} className={programCellClass}>
                        <div className="flex flex-col gap-1" title={matrixAdminCellEditable ? undefined : mgrKvTitle}>
                          {statusHidden ? (
                            <span className="text-[11px] font-medium tabular-nums text-slate-300 dark:text-slate-600">—</span>
                          ) : (
                            <>
                              <TrainingMatrixCell
                                status={eff}
                                tier={p.tier}
                                interactive={Boolean(matrixAdminCellEditable && onMatrixAdminCellCycle)}
                                disabled={cycleBusy}
                                title={adminTitle}
                                onClick={
                                  matrixAdminCellEditable && onMatrixAdminCellCycle
                                    ? () => void onMatrixAdminCellCycle(e.id, p.id)
                                    : undefined
                                }
                              />
                              {trustAssignmentStatus && a && (a.quiz_attempt_count ?? 0) > 0 ? (
                                <span className="text-[9px] font-medium tabular-nums text-slate-500">
                                  Checks: {a.quiz_attempt_count}
                                  {typeof a.quiz_latest_score_percent === "number" ? ` · ${a.quiz_latest_score_percent}%` : ""}
                                </span>
                              ) : null}
                            </>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
