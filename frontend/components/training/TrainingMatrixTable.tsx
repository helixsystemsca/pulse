"use client";

import type { TrainingAcknowledgement, TrainingAssignment, TrainingEmployee, TrainingProgram } from "@/lib/training/types";
import { effectiveAssignmentStatus } from "@/lib/training/mockData";
import { assignmentFor } from "@/lib/training/selectors";
import { TrainingStatusBadge } from "@/components/training/TrainingStatusBadge";
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
}: {
  employees: TrainingEmployee[];
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
  acknowledgements: TrainingAcknowledgement[];
}) {
  const cols = sortPrograms(programs.filter((p) => p.active));

  return (
    <div className="overflow-x-auto rounded-xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
      <table className="min-w-[720px] w-full border-collapse text-sm">
        <thead>
          <tr className={dataTableHeadRowClass}>
            <th
              scope="col"
              className="sticky left-0 z-20 min-w-[160px] bg-ds-primary px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-ds-muted shadow-[1px_0_0_var(--ds-border)]"
            >
              Employee
            </th>
            {cols.map((p) => (
              <th key={p.id} scope="col" className="min-w-[130px] px-2 py-3 text-left align-bottom">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold leading-tight text-ds-foreground">{p.title}</span>
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
                  className="sticky left-0 z-10 bg-ds-primary px-3 py-2.5 text-left font-semibold text-ds-foreground shadow-[1px_0_0_var(--ds-border)]"
                >
                  <div className="flex flex-col gap-0.5">
                    <span>{e.display_name}</span>
                    <span className="text-[11px] font-medium text-ds-muted">{e.department}</span>
                  </div>
                </th>
                {cols.map((p) => {
                  const a = assignmentFor(e.id, p.id, assignments);
                  const eff = effectiveAssignmentStatus(p, a, acknowledgements);
                  return (
                    <td key={p.id} className="px-2 py-2 align-middle">
                      <div className="flex flex-col gap-1">
                        <TrainingStatusBadge status={eff} />
                        {a?.expiry_date && eff !== "not_assigned" ? (
                          <span className="text-[10px] font-medium text-ds-muted tabular-nums">
                            Expires {a.expiry_date}
                          </span>
                        ) : null}
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
