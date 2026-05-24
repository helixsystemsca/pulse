import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { WidgetAdaptiveBody } from "@/components/dashboard/widgets/WidgetAdaptiveBody";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import {
  modeFromHeightTier,
  trainingRadialSize,
  trainingUsesRowLayout,
} from "@/lib/dashboard/widget-layout-modes";
import { cn } from "@/lib/cn";

import { ComplianceRadial } from "./ComplianceRadial";
import { StatusMetricCard } from "./StatusMetricCard";
import { TrainingMatrixButton } from "./TrainingMatrixButton";

const premiumShell =
  "rounded-xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-[rgb(248,250,252)] shadow-[0_12px_36px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04] dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/90 dark:shadow-[0_18px_44px_-26px_rgba(0,0,0,0.55)] dark:ring-white/[0.06]";

export function TrainingComplianceWidget({
  training,
  mode: modeProp,
  variant = "peek",
  matrixHref = "/standards/training/compliance#training-matrix",
  layoutContext,
  opsEmbedded = false,
}: {
  training: DashboardViewModel["training"];
  mode?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "peek" | "dashboard";
  matrixHref?: string;
  layoutContext?: DashboardWidgetRenderContext | null;
  opsEmbedded?: boolean;
}) {
  const heightTier = layoutContext?.heightTier ?? "medium";
  const zone = layoutContext?.zone ?? "edge";
  const mode = modeProp ?? modeFromHeightTier(heightTier, zone);
  const compact = mode === "xs" || mode === "sm";
  const radialSizePeek = compact ? "sm" : mode === "lg" || mode === "xl" ? "lg" : "md";
  const radialSizeDashboard = trainingRadialSize(heightTier);
  const rowLayout = trainingUsesRowLayout(heightTier);
  const metricCompact = variant === "dashboard" && heightTier === "compact";

  const completed = Math.max(0, training.completed);
  const expiring = Math.max(0, training.expiringSoon);
  const missing = Math.max(0, training.missing);
  const total = Math.max(0, training.totalSlots);

  const metricCards = (
    <>
      <StatusMetricCard
        href={matrixHref}
        icon={CheckCircle2}
        label="Completed"
        subtext="Up to date."
        count={completed}
        variant="completed"
        compact={metricCompact}
      />
      <StatusMetricCard
        href={matrixHref}
        icon={Clock}
        label="Expiring soon"
        subtext="Within 30 days."
        count={expiring}
        variant="expiring"
        compact={metricCompact}
      />
      <StatusMetricCard
        href={matrixHref}
        icon={AlertCircle}
        label="Missing"
        subtext="Requires attention."
        count={missing}
        variant="missing"
        emphasize={missing > 0}
        compact={metricCompact}
      />
    </>
  );

  const radialPair = (size: "sm" | "md" | "lg" | "xl") => (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-center",
        rowLayout ? "gap-4 sm:gap-5" : compact ? "flex-col gap-3" : "gap-3 sm:flex-row sm:gap-4",
      )}
    >
      <ComplianceRadial
        mode="overall"
        overallCompliancePercent={training.overallCompliancePercent}
        completed={completed}
        expiringSoon={expiring}
        missing={missing}
        totalSlots={total}
        size={size}
      />
      <ComplianceRadial
        mode="strict_mandatory"
        overallCompliancePercent={training.overallCompliancePercent}
        completed={completed}
        expiringSoon={expiring}
        missing={missing}
        totalSlots={total}
        size={size}
      />
    </div>
  );

  /** Peek / wide tiles: wheels beside metrics when horizontal space allows */
  const peekBody = (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col gap-5",
        compact ? "sm:flex-col" : "sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className={cn("flex flex-1 justify-center", compact ? "" : "sm:justify-start")}>
        {radialPair(radialSizePeek)}
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-2.5 sm:max-w-[min(100%,22rem)]">{metricCards}</div>
    </div>
  );

  const footerBlockPeek = (
    <div className="mt-auto flex flex-col gap-4 pt-1">
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
      <WidgetAdaptiveBody tier={heightTier} zone={zone} className={opsEmbedded ? "p-0" : cn("p-1 sm:p-1.5", premiumShell)}>
        <div
          className={cn(
            "flex h-full min-h-0 flex-1",
            rowLayout
              ? "flex-col justify-between gap-3 sm:flex-row sm:items-stretch sm:gap-4"
              : "flex-col justify-between gap-2.5",
          )}
        >
          <div
            className={cn(
              "flex min-h-0 flex-1 items-center justify-center",
              rowLayout && "sm:flex-[1.15] sm:justify-center",
            )}
          >
            {radialPair(radialSizeDashboard)}
          </div>
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col justify-center",
              heightTier === "tall" ? "gap-3" : heightTier === "compact" ? "gap-1.5" : "gap-2",
              rowLayout && "sm:max-w-[min(100%,18rem)] sm:flex-[0.95] sm:justify-center",
            )}
          >
            {metricCards}
            {!opsEmbedded && heightTier !== "compact" ? (
              <TrainingMatrixButton href={matrixHref} compact={heightTier === "medium"} fullWidth />
            ) : null}
          </div>
        </div>
      </WidgetAdaptiveBody>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-3" : "gap-4")}>
      <div className="min-w-0">
        <p className="text-base font-bold tracking-tight text-ds-foreground">Training compliance</p>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5", premiumShell)}>
        {peekBody}
        {footerBlockPeek}
      </div>
    </div>
  );
}
