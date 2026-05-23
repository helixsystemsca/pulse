"use client";

import { Bell, ChevronDown, MoreHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ScheduleWorkflowViewModel } from "@/lib/schedule/schedule-workflow";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export type ScheduleWorkflowBarProps = {
  workflow: ScheduleWorkflowViewModel;
  canManage: boolean;
  buildingDraft: boolean;
  saveBusy: boolean;
  publishBusy: boolean;
  hasPendingServerSave?: boolean;
  notifyBusy?: boolean;
  onGenerateSchedule: () => void;
  onSaveChanges: () => void;
  onRebuildSchedule?: () => void;
  onPublishSchedule: () => void;
  onOpenDailyAssignments: () => void;
  onNotifyWorkers?: () => void;
  onEditPublished?: () => void;
  onEditDraft?: () => void;
  onArchive?: () => void;
  moreMenu: ReactNode;
};

const STATUS_BADGE: Record<ScheduleWorkflowViewModel["statusTone"], string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/80",
  draft: "bg-amber-500/12 text-amber-950 ring-amber-200/70 dark:text-amber-100",
  warning: "bg-rose-500/10 text-rose-900 ring-rose-200/70 dark:text-rose-100",
  published: "bg-emerald-500/12 text-emerald-900 ring-emerald-200/70 dark:text-emerald-100",
  archived: "bg-slate-200/80 text-slate-600 ring-slate-300/80",
};

export function ScheduleWorkflowBar({
  workflow,
  canManage,
  buildingDraft,
  saveBusy,
  publishBusy,
  hasPendingServerSave = false,
  notifyBusy,
  onGenerateSchedule,
  onSaveChanges,
  onRebuildSchedule,
  onPublishSchedule,
  onOpenDailyAssignments,
  onNotifyWorkers,
  onEditPublished,
  onEditDraft,
  onArchive,
  moreMenu,
}: ScheduleWorkflowBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function close(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const { state } = workflow;

  return (
    <div className="flex w-full min-w-0 flex-col items-stretch gap-2 lg:max-w-3xl lg:items-end">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1",
            STATUS_BADGE[workflow.statusTone],
          )}
        >
          {workflow.statusLabel}
        </span>
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            workflow.mode === "operational"
              ? "bg-sky-500/10 text-sky-800 dark:text-sky-200"
              : "bg-violet-500/10 text-violet-800 dark:text-violet-200",
          )}
        >
          {workflow.mode === "operational" ? "Operations" : "Planning"}
        </span>
      </div>

      <ol className="flex flex-wrap items-center justify-end gap-1 text-[10px] font-semibold text-ds-muted">
        {workflow.steps.map((step, i) => (
          <li key={step.id} className="flex items-center gap-1">
            {i > 0 ? <span className="text-slate-300" aria-hidden>→</span> : null}
            <span
              className={cn(
                "rounded px-1.5 py-0.5",
                step.status === "complete" && "text-emerald-700 dark:text-emerald-300",
                step.status === "current" && "bg-[color-mix(in_srgb,var(--ds-accent)_12%,transparent)] text-[var(--ds-accent)]",
                step.status === "upcoming" && "text-slate-400",
                step.status === "skipped" && "text-slate-400 line-through",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      <p className="text-right text-xs leading-snug text-ds-muted">{workflow.helperText}</p>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className={cn(
              buttonVariants({ surface: "light", intent: "secondary" }),
              "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold",
            )}
            aria-expanded={menuOpen}
          >
            <MoreHorizontal className="h-4 w-4" />
            More
            <ChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
          {menuOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[220px] rounded-xl border border-pulseShell-border bg-pulseShell-surface py-1 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-950"
              role="menu"
            >
              <div className="px-1 py-1" onClick={() => setMenuOpen(false)}>
                {moreMenu}
              </div>
            </div>
          ) : null}
        </div>

        {state === "empty" && canManage ? (
          <button
            type="button"
            disabled={buildingDraft}
            onClick={onGenerateSchedule}
            className={cn(buttonVariants({ surface: "light", intent: "accent" }), "gap-2 px-4 py-2.5 text-sm font-bold")}
          >
            <Sparkles className="h-4 w-4" />
            {buildingDraft ? "Generating…" : "Generate Schedule"}
          </button>
        ) : null}

        {state === "draft_generated" && canManage ? (
          <>
            {onRebuildSchedule ? (
              <button
                type="button"
                disabled={buildingDraft}
                onClick={onRebuildSchedule}
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
              >
                {buildingDraft ? "Rebuilding…" : "Rebuild Schedule"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={saveBusy}
              onClick={onSaveChanges}
              className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5 text-sm font-bold")}
            >
              {saveBusy ? "Saving…" : "Save Changes"}
            </button>
          </>
        ) : null}

        {state === "draft_saved" && canManage ? (
          <>
            {onEditDraft ? (
              <button
                type="button"
                onClick={onEditDraft}
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
              >
                Edit Draft
              </button>
            ) : null}
            <button
              type="button"
              disabled={saveBusy || !hasPendingServerSave}
              onClick={onSaveChanges}
              className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
            >
              {saveBusy ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              disabled={publishBusy || hasPendingServerSave}
              onClick={onPublishSchedule}
              className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5 text-sm font-bold")}
            >
              {publishBusy ? "Publishing…" : "Publish Schedule"}
            </button>
          </>
        ) : null}

        {state === "published" && canManage ? (
          <>
            <button
              type="button"
              onClick={onOpenDailyAssignments}
              className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5 text-sm font-bold")}
            >
              Open Daily Assignments
            </button>
            {onNotifyWorkers ? (
              <button
                type="button"
                disabled={notifyBusy}
                onClick={onNotifyWorkers}
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "gap-1.5 px-3 py-2 text-sm")}
              >
                <Bell className="h-4 w-4" />
                {notifyBusy ? "Sending…" : "Notify Workers"}
              </button>
            ) : null}
            {onEditPublished ? (
              <button
                type="button"
                onClick={onEditPublished}
                className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
              >
                Edit Schedule
              </button>
            ) : null}
          </>
        ) : null}

        {state === "archived" && onArchive ? null : null}
      </div>
    </div>
  );
}
