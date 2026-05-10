"use client";

import { Bell, Mail, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { cn } from "@/lib/cn";
import {
  auxiliaryWorkers,
  countPendingSubmissions,
  ensureAuxiliaryRows,
  loadSubmissionMap,
  saveSubmissionMap,
  type AuxSubmissionRecord,
  type AuxSubmissionStatus,
} from "@/lib/schedule/availability-supervisor-local";
import type { Worker } from "@/lib/schedule/types";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  open: boolean;
  onClose: () => void;
  workers: Worker[];
  periodLabel: string | null;
  onMatrixChanged: () => void;
  onNotify: (message: string) => void;
};

function statusBadge(status: AuxSubmissionStatus) {
  const map = {
    submitted: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
    pending: "bg-sky-500/15 text-sky-950 dark:text-sky-100",
    overdue: "bg-rose-500/15 text-rose-950 dark:text-rose-50",
  } as const;
  return map[status];
}

export function AvailabilitySupervisorDrawer({
  open,
  onClose,
  workers,
  periodLabel,
  onMatrixChanged,
  onNotify,
}: Props) {
  const [matrix, setMatrix] = useState<Record<string, AuxSubmissionRecord>>({});

  const auxList = useMemo(() => auxiliaryWorkers(workers), [workers]);

  const syncFromStorage = useCallback(() => {
    const raw = loadSubmissionMap();
    setMatrix(ensureAuxiliaryRows(workers, raw));
  }, [workers]);

  useEffect(() => {
    if (!open) return;
    syncFromStorage();
  }, [open, syncFromStorage]);

  const auxIds = useMemo(() => auxList.map((w) => w.id), [auxList]);
  const pending = countPendingSubmissions(matrix, auxIds);
  const submitted = auxIds.filter((id) => matrix[id]?.status === "submitted").length;
  const pct = auxIds.length ? Math.round((submitted / auxIds.length) * 100) : 0;

  function persist(next: Record<string, AuxSubmissionRecord>) {
    saveSubmissionMap(next);
    setMatrix(next);
    onMatrixChanged();
  }

  function sendRequest() {
    const next = { ...matrix };
    for (const w of auxList) {
      const row = next[w.id] ?? { status: "pending" as const, remindersSent: 0 };
      if (row.status !== "submitted") {
        next[w.id] = { ...row, status: "pending", remindersSent: row.remindersSent };
      }
    }
    persist(next);
    onNotify(
      `Availability request queued for ${auxList.length} auxiliary employee${auxList.length === 1 ? "" : "s"}${periodLabel ? ` (${periodLabel})` : ""}. Email integration hooks here.`,
    );
  }

  function sendReminders() {
    const next = { ...matrix };
    let n = 0;
    for (const w of auxList) {
      const row = next[w.id] ?? { status: "pending" as const, remindersSent: 0 };
      if (row.status === "submitted") continue;
      next[w.id] = { ...row, remindersSent: row.remindersSent + 1 };
      n++;
    }
    persist(next);
    onNotify(n ? `Reminder prepared for ${n} employee${n === 1 ? "" : "s"} without submissions.` : "Everyone has submitted.");
  }

  function markDemoSubmitted(workerId: string) {
    const row = matrix[workerId] ?? { status: "pending" as const, remindersSent: 0 };
    const next = {
      ...matrix,
      [workerId]: {
        ...row,
        status: "submitted" as const,
        submittedAt: new Date().toISOString(),
      },
    };
    persist(next);
  }

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      wide
      placement="center"
      title="Availability desk"
      subtitle="Supervisor workflow — requests, reminders, and submission health (local demo persistence)."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className={buttonVariants({ surface: "light", intent: "secondary" })} onClick={onClose}>
            Close
          </button>
        </div>
      }
    >
      <div className="space-y-6 px-1">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-pulseShell-border bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm dark:from-slate-950 dark:to-slate-900/80">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Submitted</p>
            <p className="mt-1 text-2xl font-bold text-ds-foreground">
              {submitted} / {auxIds.length}
            </p>
            <p className="text-xs text-ds-muted">{pct}% complete</p>
          </div>
          <div className="rounded-xl border border-pulseShell-border bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm dark:from-slate-950 dark:to-slate-900/80">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Pending</p>
            <p className="mt-1 text-2xl font-bold text-ds-foreground">{pending}</p>
            <p className="text-xs text-ds-muted">Awaiting employee reply</p>
          </div>
          <div className="rounded-xl border border-pulseShell-border bg-gradient-to-br from-white to-slate-50/90 p-4 shadow-sm dark:from-slate-950 dark:to-slate-900/80">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Period</p>
            <p className="mt-1 text-sm font-semibold text-ds-foreground">{periodLabel ?? "No active period"}</p>
            <p className="text-xs text-ds-muted">Included in outbound requests</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={sendRequest}
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "inline-flex items-center gap-2 px-4 py-2 text-sm font-bold")}
          >
            <Mail className="h-4 w-4" />
            Request availability
          </button>
          <button
            type="button"
            onClick={sendReminders}
            className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold")}
          >
            <Bell className="h-4 w-4" />
            Send reminder
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-pulseShell-border shadow-sm dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wide text-ds-muted dark:bg-slate-900/80">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Submitted</th>
                <th className="px-3 py-2">Reminders</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pulseShell-border dark:divide-slate-800">
              {auxList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-ds-muted">
                    No auxiliary / part-time employees on this roster. Tag workers with a part-time employment type to track submissions here.
                  </td>
                </tr>
              ) : (
                auxList.map((w) => {
                  const row = matrix[w.id] ?? { status: "pending" as const, remindersSent: 0 };
                  return (
                    <tr key={w.id} className="bg-white/80 dark:bg-slate-950/40">
                      <td className="px-3 py-2 font-medium text-ds-foreground">{w.name}</td>
                      <td className="px-3 py-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold capitalize", statusBadge(row.status))}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-ds-muted">
                        {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2 text-ds-muted">{row.remindersSent}</td>
                      <td className="px-3 py-2 text-right">
                        {row.status !== "submitted" ? (
                          <button
                            type="button"
                            className="text-xs font-semibold text-[var(--ds-accent)] hover:underline"
                            onClick={() => markDemoSubmitted(w.id)}
                          >
                            Mark submitted (demo)
                          </button>
                        ) : (
                          <span className="text-xs text-ds-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="flex items-start gap-2 text-xs text-ds-muted">
          <Send className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Email and in-app notifications will plug into this workflow; matrix state is stored in sessionStorage for prototyping.
        </p>
      </div>
    </PulseDrawer>
  );
}
