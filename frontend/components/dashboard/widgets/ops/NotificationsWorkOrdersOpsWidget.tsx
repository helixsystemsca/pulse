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

const KPI_PILL_CLASS = {
  amber: "ops-kpi-pill--amber",
  teal: "ops-kpi-pill--teal",
  lobster: "ops-kpi-pill--lobster",
  accent: "ops-kpi-pill--accent",
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
    <div className={cn("ops-kpi-pill", KPI_PILL_CLASS[tone])}>
      <div className="flex max-w-full items-center justify-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: indicator }} aria-hidden />
        <span className="truncate text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "mt-2 flex min-h-[3rem] items-center justify-center text-center text-[2.75rem] font-bold leading-none tabular-nums tracking-tight",
          !loading && KPI_TONE_CLASS[tone],
          loading && "text-[color-mix(in_srgb,var(--ds-text-primary)_40%,transparent)]",
        )}
      >
        {loading ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden /> : (value ?? "—")}
      </div>
    </div>
  );
}

/** KPI strip only — title and actions live on {@link OpsWidgetShell}. */
export function NotificationsWorkOrdersOpsWidget({
  model,
  kpiLoading = false,
}: {
  model: DashboardViewModel;
  workOrdersHref?: string;
  kpiLoading?: boolean;
}) {
  const kpi = model.workRequests.kpi;

  return (
    <div className={cn("grid h-full min-h-0 grid-cols-2 items-stretch gap-2 sm:grid-cols-4")}>
      <KpiCell label="Pending approval" value={kpi?.pendingApproval ?? null} tone="amber" loading={kpiLoading} />
      <KpiCell label="In progress" value={kpi?.inProgress ?? null} tone="teal" loading={kpiLoading} />
      <KpiCell label="Overdue" value={kpi?.overdueAny ?? null} tone="lobster" loading={kpiLoading} />
      <KpiCell label="Total active" value={kpi?.total ?? null} tone="accent" loading={kpiLoading} />
    </div>
  );
}
