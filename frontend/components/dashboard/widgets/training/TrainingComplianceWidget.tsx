import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import type { WidgetRenderContext } from "@/components/dashboard/widgets/widgetSizing";
import { cn } from "@/lib/cn";

import { ComplianceRadial } from "./ComplianceRadial";
import { ComplianceSummaryFooter } from "./ComplianceSummaryFooter";
import { ScaledFit } from "./ScaledFit";
import { StatusMetricCard } from "./StatusMetricCard";
import { TrainingMatrixButton } from "./TrainingMatrixButton";

const premiumShell =
  "rounded-xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-[rgb(248,250,252)] shadow-[0_12px_36px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04] dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/90 dark:shadow-[0_18px_44px_-26px_rgba(0,0,0,0.55)] dark:ring-white/[0.06]";

/** Fixed intrinsic column width (px) — `ScaledFit` scales this down inside narrow / short grid cells. */
const DASHBOARD_DESIGN_COL_W = 280;

export function TrainingComplianceWidget({
  training,
  mode = "md",
  variant = "peek",
  matrixHref = "/standards/training#training-matrix",
  layoutContext: _layoutContext,
}: {
  training: DashboardViewModel["training"];
  mode?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "peek" | "dashboard";
  matrixHref?: string;
  /** Reserved for future mode hints; scaling uses grid cell size via ResizeObserver. */
  layoutContext?: WidgetRenderContext | null;
}) {
  void _layoutContext;
  const compact = mode === "xs" || mode === "sm";
  const radialSizePeek = compact ? "sm" : mode === "lg" || mode === "xl" ? "lg" : "md";

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
        compact={variant === "dashboard"}
      />
      <StatusMetricCard
        href={matrixHref}
        icon={Clock}
        label="Expiring soon"
        subtext="Within 30 days."
        count={expiring}
        variant="expiring"
        compact={variant === "dashboard"}
      />
      <StatusMetricCard
        href={matrixHref}
        icon={AlertCircle}
        label="Missing"
        subtext="Requires attention."
        count={missing}
        variant="missing"
        emphasize={missing > 0}
        compact={variant === "dashboard"}
      />
    </>
  );

  /** Peek / wide tiles: wheel beside metrics when horizontal space allows */
  const peekBody = (
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
          size={radialSizePeek}
        />
      </div>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-2.5 sm:max-w-[min(100%,22rem)]">{metricCards}</div>
    </div>
  );

  /** Dashboard tile: single column — wheel → metrics → copy → CTA; scaled to fit cell */
  const dashboardColumn = (
    <div className={cn("flex flex-col", compact ? "gap-2" : "gap-2.5")} style={{ width: DASHBOARD_DESIGN_COL_W }}>
      <div className="flex justify-center">
        <ComplianceRadial
          overallCompliancePercent={training.overallCompliancePercent}
          completed={completed}
          expiringSoon={expiring}
          missing={missing}
          totalSlots={total}
          size="sm"
        />
      </div>
      <div className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2")}>{metricCards}</div>
      <ComplianceSummaryFooter totalSlots={total} dense />
      <TrainingMatrixButton href={matrixHref} compact fullWidth />
    </div>
  );

  const footerBlockPeek = (
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
      <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden p-1 sm:p-1.5", premiumShell)}>
        <ScaledFit designWidthPx={DASHBOARD_DESIGN_COL_W} className="min-h-0 flex-1">
          {dashboardColumn}
        </ScaledFit>
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-3" : "gap-4")}>
      <div className="min-w-0">
        <p className="text-base font-bold tracking-tight text-ds-foreground">Training compliance</p>
        <p className="mt-1 text-xs font-medium text-ds-muted">Mandatory programs · {total.toLocaleString()} slots</p>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5", premiumShell)}>
        {peekBody}
        {footerBlockPeek}
      </div>
    </div>
  );
}
