"use client";

import { cn } from "@/lib/cn";
import type { CompetencyState, VerificationStatus } from "@/lib/standards/employee-certifications";
import type { CompetencyOverride, VerificationOverride } from "@/lib/standards/qualification-overrides";

const COMPETENCY_STYLES: Record<CompetencyState | CompetencyOverride, string> = {
  qualified: "bg-emerald-50 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-500/30",
  in_progress: "bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-500/30",
  missing: "bg-rose-50 text-rose-800 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-500/30",
  expired: "bg-rose-50 text-rose-800 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-500/30",
  revoked: "bg-slate-100 text-slate-600 ring-slate-200/80 dark:bg-ds-secondary dark:text-slate-300 dark:ring-ds-border",
};

const VERIFICATION_STYLES: Record<VerificationStatus | VerificationOverride, string> = {
  verified: "bg-emerald-50 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-200",
  pending: "bg-sky-50 text-sky-800 ring-sky-200/80 dark:bg-sky-950/40 dark:text-sky-200",
  rejected: "bg-rose-50 text-rose-800 ring-rose-200/80 dark:bg-rose-950/40 dark:text-rose-200",
  unverified: "bg-amber-50 text-amber-900 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200",
};

const COMPETENCY_LABELS: Partial<Record<string, string>> = {
  missing: "Missing",
  in_progress: "In progress",
};

const VERIFICATION_LABELS: Partial<Record<string, string>> = {
  unverified: "Unverified",
};

function formatLabel(kind: "competency" | "verification" | "severity", value: string): string {
  if (kind === "competency" && COMPETENCY_LABELS[value]) return COMPETENCY_LABELS[value]!;
  if (kind === "verification" && VERIFICATION_LABELS[value]) return VERIFICATION_LABELS[value]!;
  return value.replace(/_/g, " ");
}

export function QualificationStatusChip({
  kind,
  value,
  className,
  onClick,
  title,
}: {
  kind: "competency" | "verification" | "severity";
  value: string;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  let style = "bg-slate-100 text-slate-700 ring-slate-200/80 dark:bg-ds-secondary dark:text-slate-300 dark:ring-ds-border";
  if (kind === "competency" && value in COMPETENCY_STYLES) {
    style = COMPETENCY_STYLES[value as CompetencyState | CompetencyOverride];
  } else if (kind === "verification" && value in VERIFICATION_STYLES) {
    style = VERIFICATION_STYLES[value as VerificationStatus | VerificationOverride];
  } else if (kind === "severity") {
    if (value === "critical" || value === "expired") style = COMPETENCY_STYLES.expired;
    else if (value === "warning" || value === "expiring") style = "bg-amber-50 text-amber-900 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-200";
    else style = COMPETENCY_STYLES.qualified;
  }

  const label = formatLabel(kind, value);
  const interactive = Boolean(onClick);

  const classes = cn(
    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset",
    style,
    interactive && "cursor-pointer transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ds-primary",
    className,
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title ?? `Click to change — ${label}`}
        className={classes}
      >
        {label}
      </button>
    );
  }

  return <span className={classes}>{label}</span>;
}
