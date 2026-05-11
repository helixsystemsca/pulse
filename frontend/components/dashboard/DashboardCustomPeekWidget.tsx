"use client";

import Link from "next/link";
import type { CustomDashboardWidgetConfig } from "@/lib/dashboardPageWidgetCatalog";
import { catalogPage } from "@/lib/dashboardPageWidgetCatalog";
import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { TankIndicator } from "@/components/monitoring/TankIndicator";
import { co2Tanks, poolControllers } from "@/lib/monitoringMockData";
import { cn } from "@/lib/cn";
import type { WidgetMode } from "@/components/dashboard/widgets/widgetSizing";
import { DashboardPeekStatCard } from "@/components/dashboard/DashboardPeekStatCard";
import { TrainingComplianceWidget } from "@/components/dashboard/widgets/training/TrainingComplianceWidget";

const CO2_LEVEL_MAX = 1000;

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
  mode = "md",
}: {
  config: CustomDashboardWidgetConfig;
  model: DashboardViewModel;
  mode?: WidgetMode;
}) {
  const page = catalogPage(config.pageId);
  const href = page?.href ?? "/overview";
  const dense = mode === "lg" || mode === "xl";
  const compact = mode === "xs" || mode === "sm";
  const sliceIds = compact ? config.sliceIds.slice(0, 2) : config.sliceIds;
  const sectionGap = compact ? "space-y-3" : "space-y-5";
  const bodyOverflow = compact ? "overflow-hidden" : "overflow-auto";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", compact ? "gap-3" : "gap-4")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ds-foreground">{config.title}</p>
        <Link href={href} className="ds-link text-xs font-semibold">
          Open page →
        </Link>
      </div>
      <div className={cn("min-h-0 flex-1", sectionGap, bodyOverflow)}>
        {sliceIds.map((sid) => (
          <section key={sid} className="space-y-2 border-b border-ds-border pb-4 last:border-b-0 last:pb-0">
            {renderSlice(config, model, sid, { dense, compact })}
          </section>
        ))}
      </div>
    </div>
  );
}

function renderSlice(
  config: CustomDashboardWidgetConfig,
  model: DashboardViewModel,
  sliceId: string,
  ui: { dense: boolean; compact: boolean },
) {
  const page = catalogPage(config.pageId);
  const slice = page?.slices.find((s) => s.id === sliceId);
  const label = slice?.label ?? sliceId;
  const opts = config.sliceOptions[sliceId] ?? {};

  if (config.pageId === "monitoring") {
    if (sliceId === "pool_controllers") {
      const showChlorine = optBool(opts, "showChlorine", true);
      const showPh = optBool(opts, "showPh", true);
      const showFlow = optBool(opts, "showFlow", true);
      const showTemp = optBool(opts, "showTemp", true);
      const cols =
        (showChlorine ? 1 : 0) + (showPh ? 1 : 0) + (showFlow ? 1 : 0) + (showTemp ? 1 : 0);

      return (
        <>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
          <div className="grid gap-2 sm:gap-3">
            {poolControllers.slice(0, ui.dense ? 5 : ui.compact ? 2 : 4).map((c) => (
              <div key={c.id} className="rounded-lg border border-ds-border/70 bg-ds-secondary/35 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-xs font-semibold text-ds-foreground">{c.name}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                      c.co2FeederActive || c.chlorineFeederActive
                        ? "bg-[color-mix(in_srgb,var(--ds-success)_18%,transparent)] text-ds-foreground"
                        : "bg-ds-secondary text-ds-muted",
                    )}
                  >
                    {c.co2FeederActive || c.chlorineFeederActive ? "Active" : "Idle"}
                  </span>
                </div>

                <dl className={cn("mt-2 grid gap-2 text-[11px]", cols >= 3 ? "grid-cols-2" : "grid-cols-1")}>
                  {showChlorine ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-ds-muted">Chlorine</dt>
                      <dd className="font-semibold tabular-nums text-ds-foreground">{c.chlorine} ppm</dd>
                    </div>
                  ) : null}
                  {showPh ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-ds-muted">pH</dt>
                      <dd className="font-semibold tabular-nums text-ds-foreground">{c.ph}</dd>
                    </div>
                  ) : null}
                  {showFlow ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-ds-muted">Flow</dt>
                      <dd className="font-semibold tabular-nums text-ds-foreground">{c.flow} gpm</dd>
                    </div>
                  ) : null}
                  {showTemp ? (
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-ds-muted">Temp</dt>
                      <dd className="font-semibold tabular-nums text-ds-foreground">{c.temp} °C</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            ))}
          </div>
        </>
      );
    }

    if (sliceId === "co2_tanks") {
      const minLevel = Math.min(1000, Math.max(0, Math.floor(optNum(opts, "minLevel", 300))));
      const showPerTank = optBool(opts, "showPerTank", true);
      const allOk = co2Tanks.every((t) => t.level >= minLevel);
      return (
        <DashboardPeekStatCard label={label} footer="Mock data until live sensors are wired" tone="iris">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ds-foreground">
              <span className={cn("mr-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", allOk ? "app-badge-emerald" : "app-badge-amber")}>
                {allOk ? "OK" : "Review"}
              </span>
              Healthy if every tank ≥ <span className="tabular-nums">{minLevel}</span>
            </p>
          </div>

          {showPerTank && !ui.compact ? (
            <div className="mt-3 flex flex-wrap items-end justify-center gap-x-6 gap-y-6 sm:gap-x-8">
              {co2Tanks.map((t) => (
                <TankIndicator key={t.id} label={t.name} value={t.level} max={CO2_LEVEL_MAX} compact />
              ))}
            </div>
          ) : null}
        </DashboardPeekStatCard>
      );
    }
  }

  if (config.pageId === "inventory") {
    if (sliceId === "consumables_status") {
      const showLink = optBool(opts, "showLink", true);
      return (
        <DashboardPeekStatCard
          label={label}
          footer={showLink ? <Link href="/dashboard/inventory" className="ds-link font-semibold text-ds-accent">Open inventory →</Link> : "Same posture as the Inventory module"}
          tone="emerald"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-ds-foreground">Consumables posture</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                model.inventory.consumablesOk ? "app-badge-emerald" : "app-badge-amber"
              }`}
            >
              {model.inventory.consumablesOk ? "OK" : "Review"}
            </span>
          </div>
        </DashboardPeekStatCard>
      );
    }
    if (sliceId === "low_stock_alert") {
      return (
        <DashboardPeekStatCard label={label} footer="Matches dashboard inventory filters" tone="amber">
          {model.inventory.alert ? (
            <p className="text-sm leading-snug text-ds-foreground">
              <span className="font-semibold">{model.inventory.alert.category}:</span> {model.inventory.alert.message}
            </p>
          ) : (
            <p className="text-sm text-ds-muted">No active low-stock alert.</p>
          )}
        </DashboardPeekStatCard>
      );
    }
    if (sliceId === "shopping_list") {
      const maxItems = Math.min(20, Math.max(1, Math.floor(optNum(opts, "maxItems", 5))));
      const limit = ui.dense ? Math.max(6, maxItems) : ui.compact ? Math.min(3, maxItems) : maxItems;
      const items = model.inventory.shoppingList.slice(0, limit);
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
        <DashboardPeekStatCard label={label} footer="From open work requests on this tenant" tone="ocean">
          <p className="dash-kpi-value">{model.workRequests.awaitingCount}</p>
          <p className="mt-1 text-xs font-medium text-ds-muted">Awaiting assignment</p>
          {model.workRequests.newest ? (
            <div className="mt-3 rounded-md border border-ds-border bg-ds-secondary/30 px-3 py-2">
              <p className="text-xs font-bold text-ds-foreground">{model.workRequests.newest.title}</p>
              <p className="mt-0.5 text-[11px] text-ds-muted">{model.workRequests.newest.subtitle}</p>
            </div>
          ) : null}
        </DashboardPeekStatCard>
      );
    }
    if (sliceId === "wr_critical") {
      const maxItems = Math.min(12, Math.max(1, Math.floor(optNum(opts, "maxItems", 4))));
      const limit = ui.dense ? Math.max(6, maxItems) : ui.compact ? Math.min(2, maxItems) : maxItems;
      const rows = model.workRequests.critical.slice(0, limit);
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

  if (config.pageId === "training" && sliceId === "training_compliance") {
    return (
      <TrainingComplianceWidget
        training={model.training}
        mode={ui.compact ? "sm" : ui.dense ? "lg" : "md"}
        variant="peek"
      />
    );
  }

  if (config.pageId === "equipment" && sliceId === "equipment_counts") {
    return (
      <DashboardPeekStatCard label={label} footer="Equipment / beacon roster" tone="neutral">
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-md border border-ds-border bg-ds-secondary/35 px-2.5 py-1.5 font-semibold tabular-nums text-ds-foreground">
            Active {model.equipment.activeCount}
          </span>
          <span className="rounded-md border border-ds-border bg-ds-secondary/35 px-2.5 py-1.5 font-semibold tabular-nums text-ds-foreground">
            Missing {model.equipment.missingCount}
          </span>
          <span className="rounded-md border border-ds-border bg-ds-secondary/35 px-2.5 py-1.5 font-semibold tabular-nums text-ds-foreground">
            OOS {model.equipment.outOfServiceCount}
          </span>
        </div>
      </DashboardPeekStatCard>
    );
  }

  return (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-muted">{label}</p>
      <p className="text-sm text-ds-muted">This slice is not available for this page yet.</p>
    </>
  );
}
