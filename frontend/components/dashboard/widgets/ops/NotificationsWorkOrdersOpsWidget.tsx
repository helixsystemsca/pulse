"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { pulseApp } from "@/lib/pulse-app";
import { cn } from "@/lib/cn";

const KPI_TEAL = "var(--ds-palette-verdigris)";
const KPI_AMBER = "var(--ds-warning)";
/** Lobster pink — matches training matrix “not complete” accent. */
const KPI_LOBSTER = "#e85d6f";
const KPI_ACCENT = "var(--ds-accent)";

function KpiCell({
  label,
  value,
  valueColor,
  indicatorColor,
  loading,
}: {
  label: string;
  value: number | null;
  valueColor: string;
  indicatorColor: string;
  loading: boolean;
}) {
  return (
    <div className="flex min-h-[5.25rem] min-w-0 flex-1 flex-col rounded-lg border border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_3%,transparent)] px-2.5 py-2.5">
      <div className="flex items-center justify-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: indicatorColor }}
          aria-hidden
        />
        <span className="text-center text-[10px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
          {label}
        </span>
      </div>
      <p
        className="mt-auto flex min-h-[2.75rem] items-center justify-center pt-2 text-center text-[2rem] font-bold leading-none tabular-nums tracking-tight"
        style={{ color: loading ? undefined : valueColor }}
      >
        {loading ? (
          <Loader2
            className="h-7 w-7 animate-spin text-[color-mix(in_srgb,var(--ds-text-primary)_40%,transparent)]"
            aria-hidden
          />
        ) : (
          (value ?? "—")
        )}
      </p>
    </div>
  );
}

export function NotificationsWorkOrdersOpsWidget({
  model,
  workOrdersHref,
  kpiLoading = false,
}: {
  model: DashboardViewModel;
  workOrdersHref: string;
  kpiLoading?: boolean;
}) {
  const kpi = model.workRequests.kpi;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
        <div className="mb-2.5 flex justify-end">
          <Link
            href={pulseApp.to(workOrdersHref)}
            className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--ds-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ds-accent)] transition hover:bg-[color-mix(in_srgb,var(--ds-accent)_18%,transparent)]"
          >
            Open work requests
          </Link>
        </div>

        <div className={cn("grid grid-cols-2 items-stretch gap-2 sm:grid-cols-4")}>
          <KpiCell
            label="Pending approval"
            value={kpi?.pendingApproval ?? null}
            valueColor={KPI_AMBER}
            indicatorColor={KPI_AMBER}
            loading={kpiLoading}
          />
          <KpiCell
            label="In progress"
            value={kpi?.inProgress ?? null}
            valueColor={KPI_TEAL}
            indicatorColor={KPI_TEAL}
            loading={kpiLoading}
          />
          <KpiCell
            label="Overdue"
            value={kpi?.overdueAny ?? null}
            valueColor={KPI_LOBSTER}
            indicatorColor={KPI_LOBSTER}
            loading={kpiLoading}
          />
          <KpiCell
            label="Total active"
            value={kpi?.total ?? null}
            valueColor={KPI_ACCENT}
            indicatorColor={KPI_ACCENT}
            loading={kpiLoading}
          />
        </div>
      </div>
    </div>
  );
}
