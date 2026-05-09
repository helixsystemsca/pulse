"use client";

import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingEmployee,
  TrainingProgram,
} from "@/lib/training/types";
import { cellAssignmentStatus } from "@/lib/training/mockData";
import { assignmentFor } from "@/lib/training/selectors";
import { TrainingMatrixCell } from "@/components/training/TrainingMatrixCell";
import { TrainingTierBadge } from "@/components/training/TrainingTierBadge";
import { dataTableHeadRowClass } from "@/components/ui/DataTable";

function sortPrograms(programs: TrainingProgram[]): TrainingProgram[] {
  const order = { mandatory: 0, high_risk: 1, general: 2 } as const;
  return [...programs].sort((a, b) => order[a.tier] - order[b.tier] || a.title.localeCompare(b.title));
}

export function TrainingMatrixTable({
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
  /** When true, use each assignment's `status` from the server (training matrix API). */
  trustAssignmentStatus?: boolean;
  /** When not `all`, cells that do not match this status show a placeholder so every employee row stays visible. */
  statusColumnFilter?: TrainingAssignmentStatus | "all";
}) {
  const cols = sortPrograms(programs.filter((p) => p.active));

  return (
    <div className="overflow-x-auto rounded-xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
      <table className="min-w-[640px] w-full border-collapse text-sm">
        <thead>
          <tr className={dataTableHeadRowClass}>
            <th
              scope="col"
              className="sticky left-0 z-20 min-w-[150px] bg-ds-primary px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ds-muted shadow-[1px_0_0_var(--ds-border)]"
            >
              Employee
            </th>
            {cols.map((p) => (
              <th key={p.id} scope="col" className="min-w-[118px] px-2 py-2 text-left align-bottom">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold leading-tight text-ds-foreground">{p.title}</span>
                  <TrainingTierBadge tier={p.tier} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan={cols.length + 1} className="px-3 py-8 text-center text-sm text-ds-muted">
                No employees match the current filters.
              </td>
            </tr>
          ) : (
            employees.map((e) => (
              <tr key={e.id} className="border-t border-ds-border bg-ds-primary">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-ds-primary px-2.5 py-2 text-left font-semibold text-ds-foreground shadow-[1px_0_0_var(--ds-border)]"
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{e.display_name}</span>
                    <span className="text-[10px] font-medium text-ds-muted">{e.department}</span>
                  </div>
                </th>
                {cols.map((p) => {
                  const a = assignmentFor(e.id, p.id, assignments);
                  const eff = cellAssignmentStatus(p, a, acknowledgements, { trustAssignmentStatus });
                  const statusHidden =
                    statusColumnFilter !== "all" && eff !== statusColumnFilter;
                  return (
                    <td key={p.id} className="px-2 py-1.5 align-middle">
                      <div className="flex flex-col gap-1">
                        {statusHidden ? (
                          <>
                            <span className="sr-only">{`Assignment status: ${eff.replaceAll("_", " ")}`}</span>
                            <span
                              className="text-[11px] font-medium tabular-nums text-ds-muted/40"
                              title={`Assignment status: ${eff.replaceAll("_", " ")}`}
                              aria-hidden
                            >
                              —
                            </span>
                          </>
                        ) : (
                          <>
                            <TrainingMatrixCell status={eff} tier={p.tier} />
                            {a?.expiry_date && eff !== "not_assigned" ? (
                              <span className="text-[9px] font-medium text-ds-muted tabular-nums">
                                Expires {a.expiry_date}
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
  );
}
