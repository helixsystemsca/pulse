"use client";

import type { ComplianceSummary } from "@/lib/training/selectors";
import { cn } from "@/lib/cn";

function Card({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number | string;
  emphasis?: "neutral" | "warn" | "danger";
}) {
  const border =
    emphasis === "danger"
      ? "border-ds-danger/30"
      : emphasis === "warn"
        ? "border-[color-mix(in_srgb,var(--ds-warning)_35%,transparent)]"
        : "border-[color-mix(in_srgb,#0ea5e9_22%,transparent)]";
  return (
    <div
      className={cn(
        "rounded-xl border p-4 shadow-[0_10px_36px_-18px_rgba(14,165,233,0.35)]",
        "bg-gradient-to-br from-white via-[#f5f9ff] to-sky-100/95",
        "dark:from-slate-950 dark:via-slate-950 dark:to-sky-950/50 dark:shadow-[0_12px_40px_-20px_rgba(14,165,233,0.2)]",
        border,
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{label}</p>
      <p className="mt-2 font-headline text-3xl font-semibold tabular-nums text-ds-foreground">{value}</p>
    </div>
  );
}

export function TrainingSummaryCards({ summary }: { summary: ComplianceSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Card label="High-risk overdue" value={summary.highRiskOverdue} emphasis="danger" />
      <Card label="Expired certifications" value={summary.expiredCertifications} emphasis="danger" />
      <Card label="Pending acknowledgements" value={summary.pendingAcknowledgements} emphasis="warn" />
      <Card label="Fully compliant" value={summary.fullyCompliant} emphasis="neutral" />
      <Card label="Total employees" value={summary.totalEmployees} />
    </div>
  );
}
