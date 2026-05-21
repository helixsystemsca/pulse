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

function KpiCell({
  label,
  value,
  indicatorColor,
  loading,
}: {
  label: string;
  value: number | null;
  indicatorColor: string;
  loading: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col rounded-lg border border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_3%,transparent)] px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: indicatorColor }}
          aria-hidden
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
          {label}
        </span>
      </div>
      <p className="mt-1.5 flex min-h-[1.75rem] items-center text-xl font-bold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-[color-mix(in_srgb,var(--ds-text-primary)_40%,transparent)]" aria-hidden />
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
            Work requests
          </p>
          <Link
            href={pulseApp.to(workOrdersHref)}
            className="inline-flex items-center justify-center rounded-lg border border-[color-mix(in_srgb,var(--ds-accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-accent)_10%,transparent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--ds-accent)] transition hover:bg-[color-mix(in_srgb,var(--ds-accent)_18%,transparent)]"
          >
            Open work requests
          </Link>
        </div>

        <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4")}>
          <KpiCell
            label="Pending approval"
            value={kpi?.pendingApproval ?? null}
            indicatorColor={KPI_AMBER}
            loading={kpiLoading}
          />
          <KpiCell
            label="In progress"
            value={kpi?.inProgress ?? null}
            indicatorColor={KPI_TEAL}
            loading={kpiLoading}
          />
          <KpiCell
            label="Overdue"
            value={kpi?.overdueAny ?? null}
            indicatorColor={KPI_LOBSTER}
            loading={kpiLoading}
          />
          <KpiCell
            label="Total active"
            value={kpi?.total ?? null}
            indicatorColor="color-mix(in srgb, var(--ds-accent) 88%, var(--ds-palette-iron-grey))"
            loading={kpiLoading}
          />
        </div>
      </div>
    </div>
  );
}
