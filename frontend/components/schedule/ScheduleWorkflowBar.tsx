"use client";

import { Bell, CalendarPlus, Pencil, Settings, Sparkles } from "lucide-react";
import type { SchedulePrimaryAction, ScheduleWorkflowViewModel } from "@/lib/schedule/schedule-workflow";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
import { ScheduleAvailabilityMenu } from "./ScheduleAvailabilityMenu";

export type ScheduleWorkflowBarProps = {
  workflow: ScheduleWorkflowViewModel;
  canManage: boolean;
  buildingDraft: boolean;
  saveBusy: boolean;
  publishBusy: boolean;
  hasPendingServerSave?: boolean;
  notifyBusy?: boolean;
  onCreatePeriod: () => void;
  onGenerateSchedule: () => void;
  onSaveChanges: () => void;
  onRebuildSchedule?: () => void;
  onPublishSchedule: () => void;
  onOpenDailyAssignments: () => void;
  onNotifyWorkers?: () => void;
  onEditPublished?: () => void;
  onOpenAvailabilityRequests: () => void;
  onOpenTimeOff: () => void;
  onOpenAvailabilityPreferences: () => void;
  onOpenSettings?: () => void;
};

const STATUS_BADGE: Record<ScheduleWorkflowViewModel["statusTone"], string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200/80",
  draft: "bg-amber-500/10 text-amber-900 ring-amber-200/60 dark:text-amber-100",
  warning: "bg-rose-500/10 text-rose-900 ring-rose-200/60 dark:text-rose-100",
  published: "bg-emerald-500/10 text-emerald-900 ring-emerald-200/60 dark:text-emerald-100",
  archived: "bg-slate-200/70 text-slate-600 ring-slate-300/80",
};

export function ScheduleWorkflowBar({
  workflow,
  canManage,
  buildingDraft,
  saveBusy,
  publishBusy,
  hasPendingServerSave = false,
  notifyBusy,
  onCreatePeriod,
  onGenerateSchedule,
  onSaveChanges,
  onRebuildSchedule,
  onPublishSchedule,
  onOpenDailyAssignments,
  onNotifyWorkers,
  onEditPublished,
  onOpenAvailabilityRequests,
  onOpenTimeOff,
  onOpenAvailabilityPreferences,
  onOpenSettings,
}: ScheduleWorkflowBarProps) {
  if (!canManage) return null;

  const primary = workflow.primaryAction;

  return (
    <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-2">
      <span
        className={cn(
          "mr-auto hidden items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 sm:inline-flex",
          STATUS_BADGE[workflow.statusTone],
        )}
      >
        {workflow.statusLabel}
      </span>

      {workflow.showAvailabilityTools ? (
        <ScheduleAvailabilityMenu
          compact
          onOpenRequests={onOpenAvailabilityRequests}
          onOpenTimeOff={onOpenTimeOff}
          onOpenPreferences={onOpenAvailabilityPreferences}
        />
      ) : null}

      {workflow.showSecondaryRebuild && onRebuildSchedule ? (
        <button
          type="button"
          disabled={buildingDraft}
          onClick={onRebuildSchedule}
          className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
        >
          {buildingDraft ? "Rebuilding…" : "Rebuild"}
        </button>
      ) : null}

      {workflow.showSecondarySave && primary !== "save_changes" ? (
        <button
          type="button"
          disabled={saveBusy || !hasPendingServerSave}
          onClick={onSaveChanges}
          className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
        >
          {saveBusy ? "Saving…" : "Save"}
        </button>
      ) : null}

      {workflow.showSecondaryPublish && primary !== "publish_schedule" ? (
        <button
          type="button"
          disabled={publishBusy || hasPendingServerSave}
          onClick={onPublishSchedule}
          className={cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-3 py-2 text-sm")}
        >
          Publish
        </button>
      ) : null}

      {workflow.showSecondaryEdit && onEditPublished ? (
        <button
          type="button"
          onClick={onEditPublished}
          className={cn(
            buttonVariants({ surface: "light", intent: "secondary" }),
            "inline-flex h-9 w-9 items-center justify-center p-0",
          )}
          aria-label="Edit schedule"
          title="Edit schedule"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </button>
      ) : null}

      <PrimaryActionButton
        action={primary}
        buildingDraft={buildingDraft}
        saveBusy={saveBusy}
        publishBusy={publishBusy}
        notifyBusy={notifyBusy}
        hasPendingServerSave={hasPendingServerSave}
        onCreatePeriod={onCreatePeriod}
        onGenerateSchedule={onGenerateSchedule}
        onSaveChanges={onSaveChanges}
        onPublishSchedule={onPublishSchedule}
        onOpenDailyAssignments={onOpenDailyAssignments}
        onNotifyWorkers={onNotifyWorkers}
      />

      {onOpenSettings ? (
        <button
          type="button"
          onClick={onOpenSettings}
          className={cn(
            buttonVariants({ surface: "light", intent: "secondary" }),
            "inline-flex h-9 w-9 items-center justify-center p-0",
          )}
          aria-label="Schedule settings"
          title="Schedule settings"
        >
          <Settings className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

function PrimaryActionButton({
  action,
  buildingDraft,
  saveBusy,
  publishBusy,
  notifyBusy,
  hasPendingServerSave,
  onCreatePeriod,
  onGenerateSchedule,
  onSaveChanges,
  onPublishSchedule,
  onOpenDailyAssignments,
  onNotifyWorkers,
}: {
  action: SchedulePrimaryAction | null;
  buildingDraft: boolean;
  saveBusy: boolean;
  publishBusy: boolean;
  notifyBusy?: boolean;
  hasPendingServerSave: boolean;
  onCreatePeriod: () => void;
  onGenerateSchedule: () => void;
  onSaveChanges: () => void;
  onPublishSchedule: () => void;
  onOpenDailyAssignments: () => void;
  onNotifyWorkers?: () => void;
}) {
  if (!action) return null;

  const accent = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2.5 text-sm font-bold");

  switch (action) {
    case "create_period":
      return (
        <button type="button" onClick={onCreatePeriod} className={cn(accent, "gap-2")}>
          <CalendarPlus className="h-4 w-4" />
          Create Period
        </button>
      );
    case "generate_schedule":
      return (
        <button type="button" disabled={buildingDraft} onClick={onGenerateSchedule} className={cn(accent, "gap-2")}>
          <Sparkles className="h-4 w-4" />
          {buildingDraft ? "Generating…" : "Generate Schedule"}
        </button>
      );
    case "save_changes":
      return (
        <button type="button" disabled={saveBusy} onClick={onSaveChanges} className={accent}>
          {saveBusy ? "Saving…" : "Save Changes"}
        </button>
      );
    case "publish_schedule":
      return (
        <button
          type="button"
          disabled={publishBusy || hasPendingServerSave}
          onClick={onPublishSchedule}
          className={accent}
        >
          {publishBusy ? "Publishing…" : "Publish Schedule"}
        </button>
      );
    case "open_daily_assignments":
      return (
        <button type="button" onClick={onOpenDailyAssignments} className={accent}>
          Open Daily Assignments
        </button>
      );
    case "notify_workers":
      return onNotifyWorkers ? (
        <button type="button" disabled={notifyBusy} onClick={onNotifyWorkers} className={cn(accent, "gap-2")}>
          <Bell className="h-4 w-4" />
          {notifyBusy ? "Sending…" : "Notify Workers"}
        </button>
      ) : null;
    default:
      return null;
  }
}
