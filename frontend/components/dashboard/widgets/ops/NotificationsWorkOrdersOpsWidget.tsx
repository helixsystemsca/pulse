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
  amber: "!text-[var(--ds-warning)]",
  teal: "!text-[var(--ds-palette-verdigris)]",
  lobster: "!text-[#e85d6f]",
  neutral: "!text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)]",
} as const;

const KPI_TILE_CLASS = {
  amber: "ops-kpi-tile--amber",
  teal: "ops-kpi-tile--teal",
  lobster: "ops-kpi-tile--lobster",
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
  const indicator =
    tone === "amber"
      ? "var(--ds-warning)"
      : tone === "teal"
        ? "var(--ds-palette-verdigris)"
        : tone === "lobster"
          ? "#e85d6f"
          : "color-mix(in srgb, var(--ds-text-primary) 38%, transparent)";

  return (
    <div className="ops-work-requests-kpi-cell">
      <div className={cn("ops-kpi-tile ops-kpi-tile--grid", KPI_TILE_CLASS[tone])}>
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
          <KpiCell label="Pending approval" value={kpi?.pendingApproval ?? null} tone="amber" loading={kpiLoading} />
          <KpiCell label="In progress" value={kpi?.inProgress ?? null} tone="teal" loading={kpiLoading} />
          <KpiCell label="Overdue" value={kpi?.overdueAny ?? null} tone="lobster" loading={kpiLoading} />
          <KpiCell label="Total active" value={kpi?.total ?? null} tone="neutral" loading={kpiLoading} />
        </div>
      </div>
    </div>
  );
}
