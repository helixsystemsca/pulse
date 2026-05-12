"use client";

import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingEmployee,
  TrainingProgram,
} from "@/lib/training/types";

function verificationDetailTitle(a: TrainingAssignment | undefined, programRequiresKv: boolean): string | undefined {
  if (!a || !programRequiresKv) return undefined;
  const parts: string[] = [`Status: ${a.status.replace(/_/g, " ")}`];
  if (a.verification_first_viewed_at) {
    parts.push(`First viewed: ${new Date(a.verification_first_viewed_at).toLocaleString()}`);
  }
  if (a.verification_last_viewed_at) {
    parts.push(`Last viewed: ${new Date(a.verification_last_viewed_at).toLocaleString()}`);
  }
  const secs = a.verification_total_view_seconds ?? 0;
  if (secs > 0) {
    parts.push(`Review time: ${secs < 120 ? `${secs}s` : `${Math.round(secs / 60)} min`}`);
  }
  if (a.acknowledgement_date) {
    parts.push(`Acknowledgment: ${new Date(a.acknowledgement_date).toLocaleString()}`);
  }
  if ((a.quiz_attempt_count ?? 0) > 0) {
    parts.push(`Knowledge checks: ${a.quiz_attempt_count}`);
    if (typeof a.quiz_latest_score_percent === "number") {
      parts.push(`Latest score: ${a.quiz_latest_score_percent}%`);
    }
    if (typeof a.quiz_latest_passed === "boolean") {
      parts.push(`Latest attempt passed: ${a.quiz_latest_passed ? "yes" : "no"}`);
    }
  }
  if (a.quiz_passed_at) {
    parts.push(`Knowledge check passed: ${new Date(a.quiz_passed_at).toLocaleString()}`);
  }
  if (a.completed_date) {
    parts.push(`Compliance recorded: ${new Date(a.completed_date).toLocaleString()}`);
  }
  if (a.due_date) {
    parts.push(`Due: ${a.due_date}`);
  }
  return parts.join("\n");
}
import { cellAssignmentStatus } from "@/lib/training/mockData";
import { assignmentFor } from "@/lib/training/selectors";
import { TrainingMatrixCell } from "@/components/training/TrainingMatrixCell";
import { TrainingTierBadge } from "@/components/training/TrainingTierBadge";
import { PROCEDURE_TRACKING_TAG_LABELS, type ProcedureTrackingTagId } from "@/lib/training/procedureTrackingTags";
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
  /**
   * Normalized grid: each program column is exactly 1/12 of the table width.
   * Employee column absorbs the remainder so a single procedure column stays narrow.
   * With 12+ programs, fall back to a fixed employee rail + equal split of the rest (prevents impossible percentages).
   */
  const manyPrograms = cols.length >= 12;
  const programColShare = manyPrograms ? `calc((100% - 11rem) / ${cols.length})` : "calc(100% / 12)";
  const employeeColShare =
    cols.length === 0 ? "100%" : manyPrograms ? "11rem" : `calc(100% - ${cols.length} * (100% / 12))`;

  return (
    <div className="ds-premium-panel relative max-h-[min(80vh,960px)] min-h-0 overflow-auto">
      <table className="min-w-[640px] w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col style={{ width: employeeColShare }} />
          {cols.map((p) => (
            <col key={p.id} style={{ width: programColShare }} />
          ))}
        </colgroup>
        <thead>
          <tr className={dataTableHeadRowClass}>
            <th
              scope="col"
              className="sticky left-0 top-0 z-30 min-w-[150px] bg-ds-primary px-2.5 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-ds-muted shadow-[1px_0_0_var(--ds-border),0_1px_0_var(--ds-border)]"
            >
              Employee
            </th>
            {cols.map((p) => (
              <th
                key={p.id}
                scope="col"
                className="sticky top-0 z-20 min-w-0 bg-ds-primary px-2 py-2 text-left align-bottom shadow-[0_1px_0_0_var(--ds-border)]"
              >
                <div className="flex min-w-0 flex-col items-start gap-1.5">
                  <span className="line-clamp-3 text-[11px] font-semibold leading-tight text-ds-foreground">{p.title}</span>
                  <TrainingTierBadge tier={p.tier} />
                  {p.onboarding_required || (p.tracking_tags?.length ?? 0) > 0 ? (
                    <div className="flex min-w-0 flex-wrap gap-0.5">
                      {p.onboarding_required ? (
                        <span className="rounded bg-violet-100 px-1 py-px text-[8px] font-bold uppercase text-violet-900 dark:bg-violet-950/60 dark:text-violet-100">
                          Onboarding
                        </span>
                      ) : null}
                      {(p.tracking_tags ?? []).map((t) => (
                        <span
                          key={t}
                          className="rounded border border-ds-border bg-ds-secondary/50 px-1 py-px text-[8px] font-semibold text-ds-muted"
                        >
                          {PROCEDURE_TRACKING_TAG_LABELS[t as ProcedureTrackingTagId] ?? t}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
                  const mgrKvTitle =
                    trustAssignmentStatus && a
                      ? verificationDetailTitle(a, p.requires_knowledge_verification !== false)
                      : undefined;
                  return (
                    <td key={p.id} className="px-2 py-1.5 align-middle">
                      <div className="flex flex-col gap-1" title={mgrKvTitle}>
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
                            {trustAssignmentStatus && a && (a.quiz_attempt_count ?? 0) > 0 ? (
                              <span
                                className="text-[9px] font-medium tabular-nums text-ds-muted"
                                title="Knowledge verification attempts on current revision"
                              >
                                Checks: {a.quiz_attempt_count}
                                {typeof a.quiz_latest_score_percent === "number"
                                  ? ` · ${a.quiz_latest_score_percent}%`
                                  : ""}
                              </span>
                            ) : null}
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
