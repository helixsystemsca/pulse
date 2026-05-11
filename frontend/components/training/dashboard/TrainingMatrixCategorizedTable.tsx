"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
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
import { TrainingCategoryGroupToolbar } from "@/components/training/dashboard/TrainingCategoryGroup";

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
}: {
  employees: TrainingEmployee[];
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
  acknowledgements: TrainingAcknowledgement[];
  trustAssignmentStatus?: boolean;
  statusColumnFilter?: TrainingAssignmentStatus | "all";
}) {
  const [kw, setKw] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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

  const visiblePrograms = useMemo(
    () => groups.flatMap((g) => (collapsed[g.id] ? [] : sortPrograms(g.programs))),
    [groups, collapsed],
  );

  const stickyEmployeeTh =
    "sticky left-0 z-20 w-44 min-w-[11rem] max-w-[12rem] shrink-0 bg-white px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 shadow-[1px_0_0_var(--ds-border)] dark:bg-slate-950 dark:text-slate-400";
  const stickyEmployeeCell =
    "sticky left-0 z-10 w-44 min-w-[11rem] max-w-[12rem] shrink-0 bg-white px-2.5 py-2 text-left font-semibold text-slate-900 shadow-[1px_0_0_var(--ds-border)] dark:bg-slate-950 dark:text-slate-50";
  const programHeadClass =
    "min-w-[5rem] max-w-[9rem] border-l border-slate-100 px-2 py-2 text-left align-bottom dark:border-slate-800";
  const programCellClass =
    "min-w-[5rem] max-w-[9rem] border-l border-slate-50 px-2 py-1.5 align-middle dark:border-slate-800/80";

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
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
        <TrainingCategoryGroupToolbar
          groups={groups}
          collapsed={collapsed}
          onToggle={(id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }))}
        />
      </div>

      <div className="ds-premium-panel min-w-0 overflow-x-auto rounded-xl border border-slate-200/90 shadow-sm dark:border-slate-700/80 [-webkit-overflow-scrolling:touch]">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr className={dataTableHeadRowClass}>
              <th scope="col" className={stickyEmployeeTh}>
                Employee
              </th>
              {visiblePrograms.map((p) => (
                <th key={p.id} scope="col" className={programHeadClass}>
                  <div className="flex min-w-0 flex-col items-start gap-1">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {GROUP_LABEL[matrixCategoryForProgram(p)]}
                    </span>
                    <span className="line-clamp-3 text-[11px] font-semibold leading-tight text-slate-900 dark:text-slate-100">
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
                    <div className="flex flex-col gap-0.5">
                      <span>{e.display_name}</span>
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{e.department}</span>
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
                    return (
                      <td key={p.id} className={programCellClass}>
                        <div className="flex flex-col gap-1" title={mgrKvTitle}>
                          {statusHidden ? (
                            <span className="text-[11px] font-medium tabular-nums text-slate-300 dark:text-slate-600">—</span>
                          ) : (
                            <>
                              <TrainingMatrixCell status={eff} tier={p.tier} />
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
