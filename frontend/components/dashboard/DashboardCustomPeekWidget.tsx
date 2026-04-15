"use client";

import Link from "next/link";
import type { CustomDashboardWidgetConfig } from "@/lib/dashboardPageWidgetCatalog";
import { catalogPage } from "@/lib/dashboardPageWidgetCatalog";
import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";

function optNum(opts: Record<string, boolean | number> | undefined, key: string, fallback: number): number {
  const v = opts?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function optBool(opts: Record<string, boolean | number> | undefined, key: string, fallback: boolean): boolean {
  const v = opts?.[key];
  return typeof v === "boolean" ? v : fallback;
}

export function DashboardCustomPeekWidget({
  config,
  model,
}: {
  config: CustomDashboardWidgetConfig;
  model: DashboardViewModel;
}) {
  const page = catalogPage(config.pageId);
  const href = page?.href ?? "/overview";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ds-foreground">{config.title}</p>
        <Link href={href} className="ds-link text-xs font-semibold">
          Open page →
        </Link>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-auto">
        {config.sliceIds.map((sid) => (
          <section key={sid} className="space-y-2 border-b border-ds-border pb-4 last:border-b-0 last:pb-0">
            {renderSlice(config, model, sid)}
          </section>
        ))}
      </div>
    </div>
  );
}

function renderSlice(config: CustomDashboardWidgetConfig, model: DashboardViewModel, sliceId: string) {
  const page = catalogPage(config.pageId);
  const slice = page?.slices.find((s) => s.id === sliceId);
  const label = slice?.label ?? sliceId;
  const opts = config.sliceOptions[sliceId] ?? {};

  if (config.pageId === "monitoring") {
    if (sliceId === "pool_controllers" || sliceId === "co2_tanks") {
      return (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
          <p className="text-sm text-ds-muted">
            Monitoring widgets show your tenant&apos;s live data once sensors are connected. Add tiles after telemetry is
            available.
          </p>
        </>
      );
    }
  }

  if (config.pageId === "inventory") {
    if (sliceId === "consumables_status") {
      const showLink = optBool(opts, "showLink", true);
      return (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
          <div className="flex items-center justify-between gap-2 rounded-md border border-ds-border px-3 py-2">
            <span className="text-sm text-ds-foreground">Consumables</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                model.inventory.consumablesOk ? "app-badge-emerald" : "app-badge-amber"
              }`}
            >
              {model.inventory.consumablesOk ? "OK" : "Review"}
            </span>
          </div>
          {showLink ? (
            <Link href="/dashboard/inventory" className="ds-link text-xs">
              Inventory →
            </Link>
          ) : null}
        </>
      );
    }
    if (sliceId === "low_stock_alert") {
      return (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
          {model.inventory.alert ? (
            <p className="text-sm text-ds-foreground">
              <span className="font-semibold">{model.inventory.alert.category}:</span> {model.inventory.alert.message}
            </p>
          ) : (
            <p className="text-sm text-ds-muted">No active low-stock alert.</p>
          )}
        </>
      );
    }
    if (sliceId === "shopping_list") {
      const maxItems = Math.min(20, Math.max(1, Math.floor(optNum(opts, "maxItems", 5))));
      const items = model.inventory.shoppingList.slice(0, maxItems);
      return (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
          {items.length === 0 ? (
            <p className="text-sm text-ds-muted">Shopping list is empty.</p>
          ) : (
            <ul className="space-y-1">
              {items.map((line) => (
                <li key={line} className="truncate text-xs text-ds-foreground">
                  · {line}
                </li>
              ))}
            </ul>
          )}
        </>
      );
    }
  }

  if (config.pageId === "work_requests") {
    if (sliceId === "wr_queue") {
      return (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
          <p className="text-sm text-ds-foreground">
            <span className="font-bold tabular-nums">{model.workRequests.awaitingCount}</span> awaiting assignment
          </p>
          {model.workRequests.newest ? (
            <div className="rounded-md border border-ds-border px-3 py-2">
              <p className="text-xs font-bold text-ds-foreground">{model.workRequests.newest.title}</p>
              <p className="mt-0.5 text-[11px] text-ds-muted">{model.workRequests.newest.subtitle}</p>
            </div>
          ) : null}
        </>
      );
    }
    if (sliceId === "wr_critical") {
      const maxItems = Math.min(12, Math.max(1, Math.floor(optNum(opts, "maxItems", 4))));
      const rows = model.workRequests.critical.slice(0, maxItems);
      return (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
          {rows.length === 0 ? (
            <p className="text-sm text-ds-muted">No critical items.</p>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={r.title} className="text-xs leading-snug text-ds-foreground">
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-ds-muted"> — {r.subtitle}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      );
    }
  }

  if (config.pageId === "equipment" && sliceId === "equipment_counts") {
    return (
      <>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-md border border-ds-border px-2 py-1 font-semibold text-ds-foreground">
            Active {model.equipment.activeCount}
          </span>
          <span className="rounded-md border border-ds-border px-2 py-1 font-semibold text-ds-foreground">
            Missing {model.equipment.missingCount}
          </span>
          <span className="rounded-md border border-ds-border px-2 py-1 font-semibold text-ds-foreground">
            OOS {model.equipment.outOfServiceCount}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
      <p className="text-sm text-ds-muted">This slice is not available for this page yet.</p>
    </>
  );
}
