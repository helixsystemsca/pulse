"use client";

import type { ComplianceSummary } from "@/lib/training/selectors";
import { cn } from "@/lib/cn";

function Card({
  label,
  value,
  hint,
  emphasis,
}: {
  label: string;
  value: number | string;
  hint?: string;
  emphasis?: "neutral" | "warn" | "danger";
}) {
  const border =
    emphasis === "danger"
      ? "border-ds-danger/30"
      : emphasis === "warn"
        ? "border-[color-mix(in_srgb,var(--ds-warning)_35%,transparent)]"
        : "border-ds-border";
  return (
    <div className={cn("rounded-xl border bg-ds-primary p-4 shadow-[var(--ds-shadow-card)]", border)}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">{label}</p>
      <p className="mt-2 font-headline text-3xl font-semibold tabular-nums text-ds-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ds-muted">{hint}</p> : null}
    </div>
  );
}

export function TrainingSummaryCards({ summary }: { summary: ComplianceSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Card label="High-risk overdue" value={summary.highRiskOverdue} emphasis="danger" hint="Due past & still open" />
      <Card label="Expired certifications" value={summary.expiredCertifications} emphasis="danger" />
      <Card label="Pending acknowledgements" value={summary.pendingAcknowledgements} emphasis="warn" />
      <Card
        label="Fully compliant"
        value={summary.fullyCompliant}
        hint="Mandatory items complete & current"
        emphasis="neutral"
      />
      <Card label="Total employees" value={summary.totalEmployees} hint="Roster in Pulse (demo seed)" />
    </div>
  );
}
