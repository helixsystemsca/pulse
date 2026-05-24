"use client";

import { Loader2 } from "lucide-react";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { WidgetAdaptiveBody } from "@/components/dashboard/widgets/WidgetAdaptiveBody";
import type { WorkRequestsLayoutMode } from "@/components/dashboard/widgets/ops/work-requests-widget-layout";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { workRequestsKpiMetrics, widgetBodyHeightPx } from "@/lib/dashboard/widget-layout-modes";
import { cn } from "@/lib/cn";

const KPI_TONE_CLASS = {
  amber: "!text-[var(--ds-warning)]",
  teal: "!text-[var(--ds-palette-verdigris)]",
  lobster: "!text-[#e85d6f]",
  accent: "!text-[var(--ds-accent)]",
} as const;

const KPI_TILE_CLASS = {
  amber: "ops-kpi-tile--amber",
  teal: "ops-kpi-tile--teal",
  lobster: "ops-kpi-tile--lobster",
  accent: "ops-kpi-tile--accent",
} as const;

const GRID_MODE_CLASS: Record<WorkRequestsLayoutMode, string> = {
  "4x1": "ops-work-requests-kpi-grid--4x1",
  "2x2": "ops-work-requests-kpi-grid--2x2",
  "1x4": "ops-work-requests-kpi-grid--1x4",
};

function KpiCell({
  label,
  value,
  tone,
  loading,
  cellPx,
}: {
  label: string;
  value: number | null;
  tone: keyof typeof KPI_TONE_CLASS;
  loading: boolean;
  cellPx: number;
}) {
  const indicator =
    tone === "amber"
      ? "var(--ds-warning)"
      : tone === "teal"
        ? "var(--ds-palette-verdigris)"
        : tone === "lobster"
          ? "#e85d6f"
          : "var(--ds-accent)";

  return (
    <div className="ops-work-requests-kpi-cell">
      <div
        className={cn("ops-kpi-tile ops-kpi-tile--grid", KPI_TILE_CLASS[tone])}
        style={{ width: cellPx, height: cellPx }}
      >
        <div className="flex w-full items-start gap-1">
          <span
            className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: indicator }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 text-left text-[9px] font-bold uppercase leading-snug tracking-[0.06em] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
            {label}
          </span>
        </div>
        <div
          className={cn(
            "ops-kpi-tile__value mt-auto w-full text-left font-bold leading-none tabular-nums tracking-tight",
            !loading && KPI_TONE_CLASS[tone],
            loading && "text-[color-mix(in_srgb,var(--ds-text-primary)_40%,transparent)]",
          )}
          style={{ fontSize: cellPx >= 96 ? "1.65rem" : cellPx >= 80 ? "1.45rem" : undefined }}
        >
          {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : (value ?? "—")}
        </div>
      </div>
    </div>
  );
}

/** KPI grid — title and jump live on {@link OpsWidgetShell}. */
export function NotificationsWorkOrdersOpsWidget({
  model,
  kpiLoading = false,
  layoutContext,
  layoutMode: layoutModeProp,
}: {
  model: DashboardViewModel;
  kpiLoading?: boolean;
  layoutContext?: DashboardWidgetRenderContext;
  layoutMode?: WorkRequestsLayoutMode;
}) {
  const kpi = model.workRequests.kpi;
  const tier = layoutContext?.heightTier ?? "compact";
  const zone = layoutContext?.zone ?? "edge";
  const bodyHeight = widgetBodyHeightPx(tier);
  const bodyWidth = layoutContext?.widthPx ?? 280;
  const metrics = workRequestsKpiMetrics(tier, bodyWidth, bodyHeight);
  const layoutMode = layoutModeProp ?? metrics.layoutMode;

  return (
    <WidgetAdaptiveBody tier={tier} zone={zone} className="items-center justify-center">
      <div
        className={cn("ops-work-requests-kpi-grid h-full w-full max-w-full", GRID_MODE_CLASS[layoutMode])}
        style={{
          gap: metrics.gapPx,
          ["--ops-kpi-cell-px" as string]: `${metrics.cellPx}px`,
          ["--ops-kpi-gap-px" as string]: `${metrics.gapPx}px`,
        }}
        data-layout-mode={layoutMode}
        role="group"
        aria-label="Work request KPIs"
      >
        <KpiCell label="Pending approval" value={kpi?.pendingApproval ?? null} tone="amber" loading={kpiLoading} cellPx={metrics.cellPx} />
        <KpiCell label="In progress" value={kpi?.inProgress ?? null} tone="teal" loading={kpiLoading} cellPx={metrics.cellPx} />
        <KpiCell label="Overdue" value={kpi?.overdueAny ?? null} tone="lobster" loading={kpiLoading} cellPx={metrics.cellPx} />
        <KpiCell label="Total active" value={kpi?.total ?? null} tone="accent" loading={kpiLoading} cellPx={metrics.cellPx} />
      </div>
    </WidgetAdaptiveBody>
  );
}
