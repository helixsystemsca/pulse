"use client";

import { Loader2 } from "lucide-react";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
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
          : "var(--ds-accent)";

  return (
    <div className={cn("ops-kpi-tile ops-kpi-tile--strip", KPI_TILE_CLASS[tone])}>
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
          "ops-kpi-tile__value mt-1 w-full text-left font-bold leading-none tabular-nums tracking-tight",
          !loading && KPI_TONE_CLASS[tone],
          loading && "text-[color-mix(in_srgb,var(--ds-text-primary)_40%,transparent)]",
        )}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : (value ?? "—")}
      </div>
    </div>
  );
}

/** KPI strip only — title and jump live on {@link OpsWidgetShell}. */
export function NotificationsWorkOrdersOpsWidget({
  model,
  kpiLoading = false,
}: {
  model: DashboardViewModel;
  kpiLoading?: boolean;
}) {
  const kpi = model.workRequests.kpi;

  return (
    <div className="@container grid h-full min-h-0 grid-cols-4 grid-rows-1 items-stretch gap-1.5 @[max-width:13rem]:grid-cols-2 @[max-width:13rem]:grid-rows-2">
      <KpiCell label="Pending approval" value={kpi?.pendingApproval ?? null} tone="amber" loading={kpiLoading} />
      <KpiCell label="In progress" value={kpi?.inProgress ?? null} tone="teal" loading={kpiLoading} />
      <KpiCell label="Overdue" value={kpi?.overdueAny ?? null} tone="lobster" loading={kpiLoading} />
      <KpiCell label="Total active" value={kpi?.total ?? null} tone="accent" loading={kpiLoading} />
    </div>
  );
}
