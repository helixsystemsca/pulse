"use client";

import Link from "next/link";
import { AlertTriangle, Bell, ClipboardList } from "lucide-react";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { pulseRoutes } from "@/lib/pulse-app";
import { cn } from "@/lib/cn";

const NO_ALERTS = "No active alerts";

type AlertRow = DashboardViewModel["alerts"][number];

function alertTone(a: AlertRow): "critical" | "warn" | "info" {
  if (a.severity === "critical") return "critical";
  if (a.priority === "high") return "warn";
  return "info";
}

export function NotificationsWorkOrdersOpsWidget({
  model,
  workOrdersHref,
}: {
  model: DashboardViewModel;
  workOrdersHref: string;
}) {
  const alerts = model.alerts
    .filter((a) => a.countsTowardTotals !== false && a.title !== NO_ALERTS)
    .slice(0, 5);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]" aria-hidden />
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
              Notifications
            </p>
          </div>
          <Link href={pulseRoutes.monitoring} className="text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
            Monitoring
          </Link>
        </div>
        {alerts.length === 0 ? (
          <p className="py-2 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">You&apos;re all caught up.</p>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a, idx) => {
              const t = alertTone(a);
              return (
                <li
                  key={`${a.title}-${idx}`}
                  className={cn(
                    "rounded-lg border px-2.5 py-2 text-xs",
                    t === "critical" &&
                      "border-[color-mix(in_srgb,var(--ds-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_10%,transparent)]",
                    t === "warn" &&
                      "border-[color-mix(in_srgb,var(--ds-warning)_38%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_10%,transparent)]",
                    t === "info" && "border-[color-mix(in_srgb,var(--ds-text-primary)_12%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]",
                  )}
                >
                  <div className="flex items-start gap-2">
                    {t === "critical" ? (
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ds-danger)]" aria-hidden />
                    ) : (
                      <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold leading-snug text-[color-mix(in_srgb,var(--ds-text-primary)_94%,transparent)]">{a.title}</p>
                      {a.subtitle ? (
                        <p className="mt-0.5 whitespace-pre-line text-[11px] leading-relaxed text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                          {a.subtitle}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="min-h-0 flex-1 rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5 text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]" aria-hidden />
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
              Work orders
            </p>
          </div>
          <Link href={workOrdersHref} className="text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
            Open queue →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg bg-[color-mix(in_srgb,var(--ds-text-primary)_6%,transparent)] px-2 py-1 text-[11px] font-semibold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_85%,transparent)]">
            Awaiting <span className="ml-1 text-[var(--ds-accent)]">{model.workRequests.awaitingCount}</span>
          </span>
          <span className="rounded-lg bg-[color-mix(in_srgb,var(--ds-danger)_12%,transparent)] px-2 py-1 text-[11px] font-semibold tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_85%,transparent)]">
            Critical <span className="ml-1 text-[var(--ds-danger)]">{model.workRequests.critical.length}</span>
          </span>
        </div>
        <div className="mt-3 space-y-2 overflow-auto">
          {model.workRequests.newest ? (
            <div className="rounded-lg border border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_3%,transparent)] px-2.5 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">Newest</p>
              <p className="mt-1 text-xs font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{model.workRequests.newest.title}</p>
              <p className="mt-0.5 line-clamp-2 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">{model.workRequests.newest.subtitle}</p>
            </div>
          ) : (
            <p className="text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">No open work orders.</p>
          )}
          {model.workRequests.critical.slice(0, 3).map((row) => (
            <div
              key={row.title}
              className="flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--ds-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)] px-2.5 py-2 text-xs"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ds-danger)]" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_94%,transparent)]">{row.title}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">{row.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
