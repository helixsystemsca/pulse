import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { cn } from "@/lib/cn";

import { ComplianceRadial } from "./ComplianceRadial";
import { ComplianceSummaryFooter } from "./ComplianceSummaryFooter";
import { StatusMetricCard } from "./StatusMetricCard";
import { TrainingMatrixButton } from "./TrainingMatrixButton";

const premiumShell =
  "rounded-[22px] border border-black/[0.06] bg-gradient-to-b from-white via-white to-[rgb(248,250,252)] shadow-[0_20px_50px_-32px_rgba(15,23,42,0.35),0_8px_24px_-16px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.04] dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/90 dark:shadow-[0_24px_56px_-28px_rgba(0,0,0,0.65)] dark:ring-white/[0.06]";

export function TrainingComplianceWidget({
  training,
  mode = "md",
  variant = "peek",
  matrixHref = "/standards/training#training-matrix",
}: {
  training: DashboardViewModel["training"];
  mode?: "xs" | "sm" | "md" | "lg" | "xl";
  /** `dashboard` = built-in grid tile (title in `WorkerDashCard` chrome). `peek` = custom peek widget body. */
  variant?: "peek" | "dashboard";
  /** Team training matrix / standards training page. */
  matrixHref?: string;
}) {
  const compact = mode === "xs" || mode === "sm";
  const radialSize = compact ? "sm" : mode === "lg" || mode === "xl" ? "lg" : "md";

  const completed = Math.max(0, training.completed);
  const expiring = Math.max(0, training.expiringSoon);
  const missing = Math.max(0, training.missing);
  const total = Math.max(0, training.totalSlots);

  const body = (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5",
        compact ? "sm:flex-col" : "sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="flex flex-1 justify-center sm:justify-start">
        <ComplianceRadial
          overallCompliancePercent={training.overallCompliancePercent}
          completed={completed}
          expiringSoon={expiring}
          missing={missing}
          totalSlots={total}
          size={radialSize}
        />
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-2.5 sm:max-w-[min(100%,22rem)]">
        <StatusMetricCard
          href={matrixHref}
          icon={CheckCircle2}
          label="Completed"
          subtext="Up to date."
          count={completed}
          variant="completed"
        />
        <StatusMetricCard
          href={matrixHref}
          icon={Clock}
          label="Expiring soon"
          subtext="Within 30 days."
          count={expiring}
          variant="expiring"
        />
        <StatusMetricCard
          href={matrixHref}
          icon={AlertCircle}
          label="Missing"
          subtext="Requires attention."
          count={missing}
          variant="missing"
          emphasize={missing > 0}
        />
      </div>
    </div>
  );

  const footerBlock = (
    <div className="mt-auto flex flex-col gap-4 pt-1">
      <ComplianceSummaryFooter totalSlots={total} />
      <div className="flex flex-wrap items-center justify-end gap-3">
        {variant === "peek" ? (
          <p className="mr-auto max-w-[18rem] text-[11px] font-medium leading-snug text-ds-muted">
            <Link href={matrixHref} className="font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
              Review assignments
            </Link>{" "}
            to resolve gaps and renew expiring training.
          </p>
        ) : null}
        <TrainingMatrixButton href={matrixHref} className={compact ? "w-full sm:w-auto" : ""} compact={compact} />
      </div>
    </div>
  );

  if (variant === "dashboard") {
    return (
      <div className={cn("flex min-h-0 flex-1 flex-col gap-5 p-4 sm:p-5", premiumShell)}>
        {body}
        {footerBlock}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", compact ? "gap-3" : "gap-4")}>
      <div className="min-w-0">
        <p className="text-base font-bold tracking-tight text-ds-foreground">Training compliance</p>
        <p className="mt-1 text-xs font-medium text-ds-muted">Mandatory programs · {total.toLocaleString()} slots</p>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5", premiumShell)}>
        {body}
        {footerBlock}
      </div>
    </div>
  );
}
