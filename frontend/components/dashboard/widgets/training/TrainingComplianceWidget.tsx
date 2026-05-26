import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import type { WidgetHeightTier } from "@/lib/dashboard/workspace-layout";
import { cn } from "@/lib/cn";

import { ComplianceRadial } from "./ComplianceRadial";
import { StatusMetricCard } from "./StatusMetricCard";
import { TrainingMatrixButton } from "./TrainingMatrixButton";

const premiumShell =
  "rounded-xl border border-black/[0.06] bg-gradient-to-b from-white via-white to-[rgb(248,250,252)] shadow-[0_12px_36px_-24px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.04] dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900/90 dark:shadow-[0_18px_44px_-26px_rgba(0,0,0,0.55)] dark:ring-white/[0.06]";

function opsLayoutForTier(tier?: WidgetHeightTier): {
  radialSize: "sm" | "md" | "lg";
  dualWheels: boolean;
  badgeGap: string;
  outerGap: string;
} {
  switch (tier) {
    case "compact":
      return { radialSize: "sm", dualWheels: false, badgeGap: "gap-1", outerGap: "gap-1.5" };
    case "medium":
      return { radialSize: "sm", dualWheels: true, badgeGap: "gap-0.5", outerGap: "gap-1.5" };
    case "expanded":
    case "tall":
      return { radialSize: "lg", dualWheels: true, badgeGap: "gap-0.5", outerGap: "gap-2" };
    default:
      return { radialSize: "md", dualWheels: true, badgeGap: "gap-1", outerGap: "gap-2" };
  }
}

function TrainingComplianceOpsFill({
  training,
  matrixHref,
  opsEmbedded,
  heightTier,
}: {
  training: DashboardViewModel["training"];
  matrixHref: string;
  opsEmbedded: boolean;
  heightTier?: WidgetHeightTier;
}) {
  const layout = opsLayoutForTier(heightTier);
  const completed = Math.max(0, training.completed);
  const expiring = Math.max(0, training.expiringSoon);
  const missing = Math.max(0, training.missing);
  const total = Math.max(0, training.totalSlots);
  const denseBadges = heightTier === "medium";
  const tightBadges = heightTier === "expanded" || heightTier === "tall";
  const badgeTightClass = tightBadges ? "!gap-1.5 !px-2 !py-1.5" : undefined;

  const metricCards = (
    <>
      <StatusMetricCard
        href={matrixHref}
        icon={CheckCircle2}
        label="Completed"
        subtext="Up to date."
        count={completed}
        variant="completed"
        compact
        dense={denseBadges}
        className={badgeTightClass}
      />
      <StatusMetricCard
        href={matrixHref}
        icon={Clock}
        label="Expiring soon"
        subtext="Within 30 days."
        count={expiring}
        variant="expiring"
        compact
        dense={denseBadges}
        className={badgeTightClass}
      />
      <StatusMetricCard
        href={matrixHref}
        icon={AlertCircle}
        label="Missing"
        subtext="Requires attention."
        count={missing}
        variant="missing"
        emphasize={missing > 0}
        compact
        dense={denseBadges}
        className={badgeTightClass}
      />
    </>
  );

  return (
    <div className={cn("flex h-full min-h-0 w-full min-w-0 flex-col", layout.outerGap)}>
      <div
        className={cn(
          "flex min-h-0 flex-1 items-center justify-center overflow-hidden",
          layout.dualWheels
            ? heightTier === "medium"
              ? "gap-1.5 px-0.5"
              : "gap-2 px-0.5 sm:gap-3"
            : "gap-0",
        )}
      >
        <ComplianceRadial
          mode="overall"
          overallCompliancePercent={training.overallCompliancePercent}
          completed={completed}
          expiringSoon={expiring}
          missing={missing}
          totalSlots={total}
          size={layout.radialSize}
        />
        {layout.dualWheels ? (
          <ComplianceRadial
            mode="strict_mandatory"
            overallCompliancePercent={training.overallCompliancePercent}
            completed={completed}
            expiringSoon={expiring}
            missing={missing}
            totalSlots={total}
            size={layout.radialSize}
          />
        ) : null}
      </div>

      <div className={cn("flex shrink-0 flex-col", layout.badgeGap)}>{metricCards}</div>

      {!opsEmbedded ? <TrainingMatrixButton href={matrixHref} compact fullWidth /> : null}
    </div>
  );
}

export function TrainingComplianceWidget({
  training,
  mode = "md",
  variant = "peek",
  matrixHref = "/training/compliance/matrix#training-matrix",
  layoutContext,
  /** When true with `variant="dashboard"`, omit outer premium chrome so {@link OpsWidgetShell} provides the frame. */
  opsEmbedded = false,
}: {
  training: DashboardViewModel["training"];
  mode?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "peek" | "dashboard";
  matrixHref?: string;
  layoutContext?: DashboardWidgetRenderContext | null;
  opsEmbedded?: boolean;
}) {
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

  const radialPair = (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-center gap-4",
        compact ? "flex-col gap-3" : "sm:flex-row sm:gap-5",
      )}
    >
      <ComplianceRadial
        mode="overall"
        overallCompliancePercent={training.overallCompliancePercent}
        completed={completed}
        expiringSoon={expiring}
        missing={missing}
        totalSlots={total}
        size={radialSizePeek}
      />
      <ComplianceRadial
        mode="strict_mandatory"
        overallCompliancePercent={training.overallCompliancePercent}
        completed={completed}
        expiringSoon={expiring}
        missing={missing}
        totalSlots={total}
        size={radialSizePeek}
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
      <div className={cn("flex flex-1 justify-center", compact ? "" : "sm:justify-start")}>{radialPair}</div>

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
      <div
        className={cn(
          "flex h-full min-h-0 flex-1 flex-col overflow-hidden",
          opsEmbedded ? "p-0" : cn("p-1 sm:p-1.5", premiumShell),
        )}
      >
        <TrainingComplianceOpsFill
          training={training}
          matrixHref={matrixHref}
          opsEmbedded={opsEmbedded}
          heightTier={layoutContext?.heightTier}
        />
      </div>
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
