"use client";

import { motion } from "framer-motion";
import { Check, CheckCircle2, ClipboardCheck, Info, Save, Trash2, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";

export type InspectionStatus = "draft" | "in_progress" | "submitted";
export type PassFail = "unset" | "pass" | "fail";

/** Subtle frosted inset cards (inspection sheet). */
export const frostInset =
  "rounded-2xl border border-ds-border/45 bg-white/45 p-4 shadow-sm backdrop-blur-md dark:bg-ds-secondary/35 dark:border-ds-border/35";

export function nowStamp(): string {
  return new Date().toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function clampProgress(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function StatusPill({ status }: { status: InspectionStatus }) {
  const cls =
    status === "submitted"
      ? "border-stone-200/90 bg-stone-50/95 text-stone-800 dark:border-stone-600/50 dark:bg-stone-900/45 dark:text-stone-100"
      : status === "in_progress"
        ? "border-[color-mix(in_srgb,var(--ds-accent)_38%,var(--ds-border))] bg-[color-mix(in_srgb,var(--ds-accent)_12%,var(--ds-primary))] text-ds-foreground"
        : "border-amber-200/60 bg-amber-50/80 text-amber-950 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-100";

  const dot =
    status === "submitted"
      ? "bg-stone-400 dark:bg-stone-500"
      : status === "in_progress"
        ? "bg-[var(--ds-accent)]"
        : "bg-amber-400";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur",
        cls,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      {status === "draft" ? "Draft" : status === "in_progress" ? "In Progress" : "Submitted"}
    </span>
  );
}

export type InspectionSheetStatCard = {
  label: string;
  title: string;
  subtitle: string;
};

export function InspectionSheetHeader({
  title,
  generatedAt,
  status,
  completion,
  statCards,
  icon: Icon = ClipboardCheck,
}: {
  title: string;
  generatedAt: string;
  status: InspectionStatus;
  completion: number;
  statCards: InspectionSheetStatCard[];
  icon?: LucideIcon;
}) {
  return (
    <Card className="relative overflow-hidden rounded-2xl border border-ds-border/50 bg-white/35 shadow-sm backdrop-blur-xl dark:bg-ds-secondary/30">
      <div className="relative p-5 sm:p-6">
        <motion.div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-ds-border/50 bg-white/50 shadow-sm backdrop-blur-sm dark:bg-ds-secondary/50">
                <Icon className="h-5 w-5 text-[var(--ds-accent)]" aria-hidden />
              </span>
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold tracking-tight text-ds-foreground sm:text-xl">{title}</h1>
                <p className="mt-0.5 text-xs font-medium text-ds-muted">Generated {generatedAt}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <StatusPill status={status} />
            <div className="flex min-w-[190px] flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] font-semibold text-ds-muted">
                <span>Completion</span>
                <span className="tabular-nums text-ds-foreground">{completion}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full border border-ds-border/50 bg-stone-100/80 dark:bg-stone-900/40">
                <motion.div
                  className="h-full rounded-full bg-[var(--ds-accent)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${completion}%` }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {statCards.map((card) => (
            <div key={card.label} className={frostInset}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{card.label}</p>
              <p className="mt-1 text-sm font-semibold text-ds-foreground">{card.title}</p>
              <p className="mt-0.5 text-xs font-medium text-ds-muted">{card.subtitle}</p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function GlassSection({
  title,
  subtitle,
  icon,
  children,
  stickyId,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: React.ReactNode;
  stickyId: string;
}) {
  const Icon = icon;
  return (
    <Card className="relative overflow-hidden rounded-2xl border border-ds-border/50 bg-ds-primary shadow-sm dark:bg-ds-secondary">
      <div className="relative p-5 sm:p-6">
        <div
          id={stickyId}
          className={cn(
            "sticky top-2 z-[2] -mx-2 mb-4 flex items-start justify-between gap-4 rounded-xl border border-ds-border/40 bg-white/55 px-4 py-3 shadow-sm backdrop-blur-md dark:bg-ds-secondary/45",
            "sm:static sm:mx-0 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none dark:sm:bg-transparent",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-ds-border/50 bg-white/50 shadow-sm backdrop-blur-sm dark:bg-ds-secondary/50">
                <Icon className="h-4 w-4 text-[var(--ds-accent)]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold tracking-tight text-ds-foreground">{title}</p>
                {subtitle ? <p className="mt-0.5 text-xs font-medium text-ds-muted">{subtitle}</p> : null}
              </div>
            </div>
          </div>
        </div>

        {children}
      </div>
    </Card>
  );
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <label className={dsLabelClass}>
          {label} {required ? <span className="text-red-500">*</span> : null}
        </label>
        {hint ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-ds-muted">
            <Info className="h-3.5 w-3.5" aria-hidden />
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ChecklistRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: PassFail;
  onChange: (next: PassFail) => void;
}) {
  const Icon = icon;
  const tone =
    value === "pass"
      ? "border-stone-200/80 bg-stone-50/90 shadow-[0_0_0_1px_rgba(231,229,228,0.6)] dark:border-stone-600/40 dark:bg-stone-900/35"
      : value === "fail"
        ? "border-rose-300/40 bg-rose-50/70 shadow-sm dark:border-rose-500/25 dark:bg-rose-950/25"
        : "border-ds-border/50 bg-white/35 shadow-sm backdrop-blur-sm dark:bg-ds-secondary/30";

  const cycle = useCallback(() => {
    onChange(value === "unset" ? "pass" : value === "pass" ? "fail" : "unset");
  }, [onChange, value]);

  return (
    <motion.button
      type="button"
      onClick={cycle}
      className={cn(
        "group relative flex w-full items-center justify-between gap-4 rounded-2xl border p-4 text-left transition-[transform,box-shadow,border-color,background-color] duration-200",
        "hover:-translate-y-[1px] hover:border-ds-border/80 focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]",
        tone,
      )}
      whileTap={{ scale: 0.99 }}
      layout
    >
      <span className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] opacity-50" />
      <div className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-ds-border/50 bg-white/45 shadow-sm backdrop-blur-sm dark:bg-ds-secondary/45">
          <Icon className="h-4.5 w-4.5 text-ds-foreground" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ds-foreground">{label}</span>
          <span className="mt-0.5 block text-xs font-medium text-ds-muted">
            {value === "unset" ? "Tap to mark pass / fail" : value === "pass" ? "Passed" : "Failed"}
          </span>
        </span>
      </div>

      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            value === "pass"
              ? "border-stone-300/60 bg-stone-100/90 text-stone-800 dark:border-stone-500/40 dark:bg-stone-800/60 dark:text-stone-100"
              : "border-ds-border/50 bg-white/40 text-ds-muted backdrop-blur-sm group-hover:text-ds-foreground dark:bg-ds-secondary/40",
          )}
          aria-label="Pass"
        >
          <CheckCircle2 className="h-4.5 w-4.5" aria-hidden />
        </span>
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
            value === "fail"
              ? "border-rose-400/40 bg-rose-500/20 text-rose-50"
              : "border-ds-border bg-ds-secondary/60 text-ds-muted group-hover:text-ds-foreground",
          )}
          aria-label="Fail"
        >
          <XCircle className="h-4.5 w-4.5" aria-hidden />
        </span>
      </span>
    </motion.button>
  );
}

export function AutoGrowTextarea({
  value,
  onChange,
  className,
  placeholder,
  minRows = 4,
  id,
  invalid,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
  invalid?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, minRows * 22)}px`;
  }, [minRows]);

  useEffect(() => resize(), [resize, value]);

  return (
    <textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        dsInputClass,
        "min-h-[6.5rem] resize-none leading-relaxed",
        invalid ? "border-rose-400/60 focus:border-rose-400/70 focus:ring-rose-500/20" : "",
        className ?? "",
      )}
      rows={minRows}
    />
  );
}

export function GradientPrimaryButton({
  disabled,
  children,
  onClick,
  title,
}: {
  disabled?: boolean;
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold tracking-tight text-[var(--ds-on-accent)]",
        "shadow-[0_12px_32px_color-mix(in_srgb,var(--ds-accent)_35%,transparent)] transition-[transform,box-shadow,filter] duration-200",
        "bg-[linear-gradient(135deg,var(--ds-accent),color-mix(in_srgb,var(--ds-accent)_82%,#0f766e))]",
        "hover:-translate-y-[1px] hover:shadow-[0_16px_40px_color-mix(in_srgb,var(--ds-accent)_40%,transparent)] focus:outline-none focus:ring-2 focus:ring-[var(--ds-focus-ring)]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
      )}
    >
      <span className="absolute inset-0 rounded-2xl bg-[radial-gradient(700px_circle_at_20%_0%,rgba(255,255,255,0.35),transparent_42%)] opacity-70" />
      <span className="relative flex items-center gap-2">{children}</span>
    </button>
  );
}

export function InspectionSheetFooter({
  requiredOk,
  status,
  onSaveDraft,
  onClear,
  onSubmit,
  submitLabel = "Submit Inspection",
}: {
  requiredOk: boolean;
  status: InspectionStatus;
  onSaveDraft: () => void;
  onClear: () => void;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-ds-border/50 bg-white/55 backdrop-blur-xl supports-[backdrop-filter]:bg-white/45 dark:bg-ds-secondary/55">
      <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" className="rounded-2xl" onClick={onSaveDraft} title="Save draft (local mock)">
            <Save className="h-4 w-4" aria-hidden />
            Save Draft
          </Button>
          <Button variant="secondary" className="rounded-2xl" onClick={onClear} title="Clear all fields">
            <Trash2 className="h-4 w-4" aria-hidden />
            Clear Form
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <motion.div className="hidden sm:flex items-center gap-2 rounded-2xl border border-ds-border/45 bg-white/50 px-3 py-2 text-xs font-semibold text-ds-muted backdrop-blur-sm dark:bg-ds-secondary/40">
            <span
              className={cn(
                !requiredOk ? "text-amber-800 dark:text-amber-200" : "text-[var(--ds-accent)] dark:text-teal-300",
              )}
            >
              {!requiredOk ? "Complete required fields to submit" : "Ready to submit"}
            </span>
          </motion.div>
          <GradientPrimaryButton
            disabled={!requiredOk || status === "submitted"}
            onClick={onSubmit}
            title={
              !requiredOk
                ? "Complete required fields first"
                : status === "submitted"
                  ? "Already submitted"
                  : submitLabel
            }
          >
            <Check className="h-4 w-4" aria-hidden />
            {submitLabel}
          </GradientPrimaryButton>
        </div>
      </div>
    </div>
  );
}

export function InspectionSheetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div className="mx-auto w-full max-w-[1100px] space-y-6 pb-28">{children}</div>
    </div>
  );
}
