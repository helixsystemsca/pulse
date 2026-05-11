"use client";

import { CalendarDays, ChevronDown, MoreHorizontal, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

export type SchedulePeriodHeaderState =
  | {
      kind: "active";
      status: "open" | "draft";
      rangeLabel: string;
      deadlineLabel?: string | null;
    }
  | { kind: "empty"; allowCreate?: boolean };

export type ScheduleBuilderHeaderProps = {
  period: SchedulePeriodHeaderState;
  onManagePeriod: () => void;
  onCreatePeriod: () => void;
  /** When false, Save draft is omitted (e.g. offline demo). */
  showSaveDraft?: boolean;
  saveDraftDisabled: boolean;
  saveBusy: boolean;
  onSaveDraft: () => void;
  showPublish: boolean;
  publishBusy?: boolean;
  onPublish: () => void;
  showBuildDraft: boolean;
  buildingDraft: boolean;
  onBuildDraft: () => void;
  moreMenu: ReactNode;
};

export type ScheduleBuilderIdentityProps = Pick<
  ScheduleBuilderHeaderProps,
  "period" | "onManagePeriod" | "onCreatePeriod"
>;

export type ScheduleBuilderActionsProps = Omit<
  ScheduleBuilderHeaderProps,
  "period" | "onManagePeriod" | "onCreatePeriod"
>;

/** Outer shell for schedule builder / unified workspace header. */
export const SCHEDULE_BUILDER_HEADER_SHELL =
  "relative overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-border))] bg-gradient-to-br from-white via-[color-mix(in_srgb,var(--ds-secondary)_88%,white)] to-[color-mix(in_srgb,var(--ds-accent)_6%,white)] px-5 py-5 shadow-[0_12px_40px_-18px_rgba(15,23,42,0.22)] dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/95 dark:border-slate-700/80 dark:shadow-black/40";

export function ScheduleBuilderIdentity({ period, onManagePeriod, onCreatePeriod }: ScheduleBuilderIdentityProps) {
  return (
    <div className="flex min-w-0 gap-4">
      <span
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] text-[var(--ds-accent)] shadow-inner dark:bg-sky-500/15 dark:text-sky-300"
        aria-hidden
      >
        <CalendarDays className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <div className="min-w-0 space-y-2">
        <div>
          <h1 className="font-headline text-2xl font-bold tracking-tight text-ds-foreground">Schedule</h1>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-ds-muted">
            Manage staffing, coverage, and availability across your operation.
          </p>
        </div>
        {period.kind === "active" ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold",
                period.status === "open"
                  ? "bg-emerald-500/12 text-emerald-900 dark:text-emerald-100"
                  : "bg-amber-500/12 text-amber-950 dark:text-amber-100",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  period.status === "open" ? "bg-emerald-500" : "bg-amber-400",
                )}
              />
              {period.status === "open" ? "Availability open" : "Period draft"}
              <span className="font-medium text-ds-muted">·</span>
              <span className="text-ds-foreground">{period.rangeLabel}</span>
              {period.deadlineLabel ? (
                <span className="font-normal text-ds-muted">{period.deadlineLabel}</span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={onManagePeriod}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-[var(--ds-accent)] hover:bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)]"
            >
              Manage period
            </button>
          </div>
        ) : period.allowCreate === false ? (
          <p className="text-xs text-ds-muted">No active scheduling period.</p>
        ) : (
          <div className="rounded-xl border border-dashed border-ds-border/80 bg-ds-secondary/40 px-4 py-3 dark:bg-slate-900/50">
            <p className="text-sm font-semibold text-ds-foreground">No active scheduling period</p>
            <p className="mt-1 text-xs leading-relaxed text-ds-muted">
              Create a scheduling period to collect availability, assign shifts, manage staffing coverage, and publish
              schedules.
            </p>
            <button
              type="button"
              onClick={onCreatePeriod}
              className={cn(
                buttonVariants({ surface: "light", intent: "accent" }),
                "mt-3 px-4 py-2 text-xs font-bold",
              )}
            >
              Create schedule period
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ScheduleBuilderActions({
  showSaveDraft = true,
  saveDraftDisabled,
  saveBusy,
  onSaveDraft,
  showPublish,
  publishBusy,
  onPublish,
  showBuildDraft,
  buildingDraft,
  onBuildDraft,
  moreMenu,
}: ScheduleBuilderActionsProps) {
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

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            buttonVariants({ surface: "light", intent: "secondary" }),
            "inline-flex w-full items-center justify-center gap-2 border border-transparent px-3 py-2 text-sm font-semibold sm:w-auto",
          )}
          aria-expanded={menuOpen}
          aria-haspopup="true"
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
      {showBuildDraft ? (
        <button
          type="button"
          onClick={onBuildDraft}
          disabled={buildingDraft}
          className={cn(
            buttonVariants({ surface: "light", intent: "secondary" }),
            "inline-flex items-center justify-center gap-2 border border-transparent px-3 py-2 text-sm font-semibold disabled:opacity-50",
          )}
        >
          <Sparkles className="h-4 w-4 opacity-80" />
          {buildingDraft ? "Building…" : "Build draft"}
        </button>
      ) : null}
      {showSaveDraft ? (
        <button
          type="button"
          disabled={saveDraftDisabled}
          onClick={onSaveDraft}
          className={cn(
            buttonVariants({ surface: "light", intent: "secondary" }),
            "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45",
          )}
        >
          {saveBusy ? "Saving…" : "Save draft"}
        </button>
      ) : null}
      {showPublish ? (
        <button
          type="button"
          disabled={publishBusy}
          onClick={onPublish}
          className={cn(
            buttonVariants({ surface: "light", intent: "accent" }),
            "inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold shadow-md disabled:opacity-60",
          )}
        >
          {publishBusy ? "Publishing…" : "Publish schedule"}
        </button>
      ) : null}
    </div>
  );
}

export function ScheduleBuilderHeader({
  period,
  onManagePeriod,
  onCreatePeriod,
  ...actionsProps
}: ScheduleBuilderHeaderProps) {
  return (
    <header className={SCHEDULE_BUILDER_HEADER_SHELL}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <ScheduleBuilderIdentity period={period} onManagePeriod={onManagePeriod} onCreatePeriod={onCreatePeriod} />
        <ScheduleBuilderActions {...actionsProps} />
      </div>
    </header>
  );
}
