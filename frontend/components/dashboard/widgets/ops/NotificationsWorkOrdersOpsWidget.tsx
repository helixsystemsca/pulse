"use client";

import type { CSSProperties } from "react";
import { Loader2 } from "lucide-react";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import {
  WORK_REQUESTS_KPI_CELL_PX,
  WORK_REQUESTS_KPI_GAP_PX,
  type WorkRequestsLayoutMode,
} from "@/components/dashboard/widgets/ops/work-requests-widget-layout";
import { cn } from "@/lib/cn";

const KPI_TONE_CLASS = {
  warning: "text-[var(--ds-warning)]",
  success: "text-[var(--ds-success)]",
  danger: "text-[var(--ds-danger)]",
  neutral: "text-[color-mix(in_srgb,var(--ds-text-primary)_82%,transparent)]",
} as const;

const KPI_TILE_CLASS = {
  warning: "ops-kpi-tile--warning",
  success: "ops-kpi-tile--success",
  danger: "ops-kpi-tile--danger",
  neutral: "ops-kpi-tile--neutral",
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
}: {
  label: string;
  value: number | null;
  tone: keyof typeof KPI_TONE_CLASS;
  loading: boolean;
}) {
  return (
    <div className="ops-work-requests-kpi-cell">
      <div className={cn("ops-kpi-tile ops-kpi-tile--grid ops-kpi-tile--centered", KPI_TILE_CLASS[tone])}>
        <span className="ops-kpi-tile__label">{label}</span>
        <div
          className={cn(
            "ops-kpi-tile__value flex min-h-0 flex-1 w-full items-center justify-center font-bold leading-none tabular-nums tracking-tight",
            !loading && KPI_TONE_CLASS[tone],
            loading && "text-[var(--ds-text-secondary)]",
          )}
        >
          {loading ? <Loader2 className="h-6 w-6 animate-spin" aria-hidden /> : (value ?? "—")}
        </div>
      </div>
    </div>
  );
}

/** KPI grid — title and jump live on {@link OpsWidgetShell}. */
export function NotificationsWorkOrdersOpsWidget({
  model,
  kpiLoading = false,
  layoutMode = "4x1",
}: {
  model: DashboardViewModel;
  kpiLoading?: boolean;
  layoutMode?: WorkRequestsLayoutMode;
}) {
  const kpi = model.workRequests.kpi;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col">
        <div
          className={cn("ops-work-requests-kpi-grid mt-auto min-h-0", GRID_MODE_CLASS[layoutMode])}
          style={
            {
              gap: WORK_REQUESTS_KPI_GAP_PX,
              ["--ops-wr-kpi-cell" as string]: `${WORK_REQUESTS_KPI_CELL_PX}px`,
            } as CSSProperties
          }
          data-layout-mode={layoutMode}
          role="group"
          aria-label="Work request KPIs"
        >
          <KpiCell label="Pending approval" value={kpi?.pendingApproval ?? null} tone="warning" loading={kpiLoading} />
          <KpiCell label="In progress" value={kpi?.inProgress ?? null} tone="success" loading={kpiLoading} />
          <KpiCell label="Overdue" value={kpi?.overdueAny ?? null} tone="danger" loading={kpiLoading} />
          <KpiCell label="Total active" value={kpi?.total ?? null} tone="neutral" loading={kpiLoading} />
        </div>
      </div>
    </div>
  );
}
