"use client";

import { AlertTriangle, Check, ChevronRight, X } from "lucide-react";
import { useMemo } from "react";
import type { DrawerTrainingLine, EmployeeComplianceRowModel } from "@/lib/training/dashboardMetrics";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

function statusIcon(status: DrawerTrainingLine["status"]) {
  if (status === "completed") {
    return <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />;
  }
  if (status === "expiring_soon") {
    return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden />;
  }
  return <X className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden />;
}

function LineCard({ line }: { line: DrawerTrainingLine }) {
  return (
    <li className="flex gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mt-0.5 shrink-0">{statusIcon(line.status)}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{line.title}</p>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {line.statusLabel}
          </span>
        </div>
        <dl className="mt-1.5 grid gap-1 text-[11px] text-slate-600 dark:text-slate-300">
          {line.score ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Score</dt>
              <dd className="font-medium tabular-nums">{line.score}</dd>
            </div>
          ) : null}
          {line.quizDetail ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Quiz</dt>
              <dd>{line.quizDetail}</dd>
            </div>
          ) : null}
          {line.completedDate ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Completed</dt>
              <dd className="tabular-nums">{line.completedDate}</dd>
            </div>
          ) : null}
          {line.expiryDate ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Expiry</dt>
              <dd className="tabular-nums">{line.expiryDate}</dd>
            </div>
          ) : null}
          {line.assignedBy ? (
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500 dark:text-slate-400">Assigned by</dt>
              <dd className="truncate">{line.assignedBy}</dd>
            </div>
          ) : null}
        </dl>
        {line.needsRetrain ? (
          <Button type="button" variant="secondary" className="mt-2 h-8 text-xs" disabled title="Retrain scheduling coming soon">
            Retrain
            <ChevronRight className="ml-0.5 h-3.5 w-3.5 opacity-60" aria-hidden />
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function Section({ title, lines }: { title: string; lines: DrawerTrainingLine[] }) {
  if (lines.length === 0) return null;
  return (
    <section>
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      <ul className="mt-2 space-y-2">
        {lines.map((line) => (
          <LineCard key={line.id} line={line} />
        ))}
      </ul>
    </section>
  );
}

export function EmployeeTrainingDrawer({
  open,
  onClose,
  row,
  lines,
}: {
  open: boolean;
  onClose: () => void;
  row: EmployeeComplianceRowModel | null;
  lines: DrawerTrainingLine[];
}) {
  const bySection = useMemo(() => {
    return {
      mandatory: lines.filter((l) => l.section === "mandatory"),
      equipment: lines.filter((l) => l.section === "equipment"),
      seasonal: lines.filter((l) => l.section === "seasonal"),
      general: lines.filter((l) => l.section === "general"),
      quiz: lines.filter((l) => Boolean(l.quizDetail)),
      expiring: lines.filter((l) => Boolean(l.expiryDate)),
    };
  }, [lines]);

  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[1px] transition-opacity"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <aside
        className={cn(
          "relative flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl",
          "duration-200 animate-in slide-in-from-right dark:border-slate-700 dark:bg-slate-950",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Employee record</p>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-900 dark:text-slate-50">{row.employee.display_name}</h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{row.employee.department}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {row.roleLabel} · {row.shiftLabel}
            </p>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-4">
          <Section title="Routines" lines={bySection.mandatory} />
          <Section title="Equipment certifications" lines={bySection.equipment} />
          <Section title="Seasonal training" lines={bySection.seasonal} />
          <Section title="SOP read & sign" lines={bySection.general} />
          <Section title="Quiz results" lines={bySection.quiz} />
          <Section title="Expiring certifications" lines={bySection.expiring} />
        </div>
      </aside>
    </div>
  );
}
