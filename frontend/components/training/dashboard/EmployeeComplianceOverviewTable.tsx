"use client";

import { ChevronRight } from "lucide-react";
import type { EmployeeComplianceRowModel } from "@/lib/training/dashboardMetrics";
import { ProgressCell } from "@/components/training/dashboard/ProgressCell";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function rowBorderClass(accent: EmployeeComplianceRowModel["rowAccent"]): string {
  if (accent === "risk") return "border-l-[3px] border-l-rose-500";
  if (accent === "expiring") return "border-l-[3px] border-l-amber-400";
  return "border-l-[3px] border-l-emerald-500";
}

export function EmployeeComplianceOverviewTable({
  rows,
  onRowOpen,
  dense,
}: {
  rows: EmployeeComplianceRowModel[];
  onRowOpen: (row: EmployeeComplianceRowModel) => void;
  /** When true, hide role/shift columns (e.g. Overview default). */
  dense?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm",
        "dark:border-slate-700/80 dark:bg-slate-900/40",
      )}
    >
      <div className="w-full overflow-x-auto">
        <table className="w-full max-w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left dark:border-slate-800 dark:bg-slate-900/80">
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Employee
              </th>
              {!dense ? (
                <>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Role
                  </th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Shift
                  </th>
                </>
              ) : null}
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Routines
              </th>
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Expiring
              </th>
              <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Last activity
              </th>
              <th className="px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={dense ? 5 : 7}
                  className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400"
                >
                  No employees match the current filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.employee.id}
                  className={cn(
                    "border-b border-slate-100 transition-colors hover:bg-slate-50/80 dark:border-slate-800/90 dark:hover:bg-slate-800/40",
                    rowBorderClass(r.rowAccent),
                  )}
                >
                  <td className="px-3 py-3 align-middle">
                    <button
                      type="button"
                      onClick={() => onRowOpen(r)}
                      className="group flex w-full min-w-0 flex-col rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-500/70"
                    >
                      <span className="font-semibold text-slate-900 group-hover:text-teal-700 dark:text-slate-100 dark:group-hover:text-teal-300">
                        {r.employee.display_name}
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">{r.employee.department}</span>
                    </button>
                  </td>
                  {!dense ? (
                    <>
                      <td className="px-3 py-3 align-middle text-slate-700 dark:text-slate-200">{r.roleLabel}</td>
                      <td className="px-3 py-3 align-middle text-slate-600 dark:text-slate-300">{r.shiftLabel}</td>
                    </>
                  ) : null}
                  <td className="px-3 py-3 align-middle">
                    {r.mandatoryTotal === 0 ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <ProgressCell pct={r.mandatoryPct} label={r.mandatoryLabel} />
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle text-xs text-slate-700 dark:text-slate-200">
                    {r.expiringSoonCount > 0 ? (
                      <span>
                        <span className="font-semibold tabular-nums">{r.expiringSoonCount}</span>
                        {r.nearestExpiry ? (
                          <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400">
                            Next {r.nearestExpiry}
                          </span>
                        ) : null}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 align-middle text-xs text-slate-600 dark:text-slate-300">
                    {r.lastActivityLabel ?? "—"}
                  </td>
                  <td className="px-3 py-3 align-middle text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button type="button" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => onRowOpen(r)}>
                        Details
                        <ChevronRight className="ml-0.5 h-3.5 w-3.5 opacity-70" aria-hidden />
                      </Button>
                      <Button type="button" variant="secondary" className="h-8 px-2.5 text-xs" disabled title="Coming soon">
                        Assign
                      </Button>
                      <Button type="button" variant="secondary" className="h-8 px-2.5 text-xs" disabled title="Coming soon">
                        Remind
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
