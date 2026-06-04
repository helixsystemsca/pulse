"use client";

import {
  AlertTriangle,
  Box,
  ClipboardList,
  Clock,
  Loader2,
  Package,
  TrendingUp,
} from "lucide-react";
import type { InventorySummary } from "@/lib/inventoryService";
import { formatDurationHours, formatYoyReplenishChange } from "@/lib/inventory/format-duration-hours";
import { cn } from "@/lib/cn";

type MetricCard = {
  label: string;
  value: string | number;
  icon: typeof Package;
  sub: string | null;
  tone: string;
  alert?: boolean;
};

function inventoryMetricShortLabel(label: string): string {
  if (label === "Total items") return "Items";
  if (label === "In stock") return "Stock";
  if (label === "Low stock") return "Low";
  if (label === "Inventory value") return "Value";
  if (label.startsWith("Avg time in queue")) return "Queue";
  if (label.startsWith("Avg low")) return "Restock";
  if (label.startsWith("Replenish")) return "YoY";
  const top = /^Top (\d) by uses$/.exec(label);
  if (top) return `Top ${top[1]}`;
  return label;
}

function buildMetricCards(summary: InventorySummary): MetricCard[] {
  const rm = summary.replenishment_metrics;
  const replenishCards: MetricCard[] = rm
    ? [
        {
          label: "Avg time in queue (now)",
          value: formatDurationHours(rm.current_avg_time_in_queue_hours),
          icon: Clock,
          sub:
            rm.active_queue_count > 0
              ? `${rm.active_queue_count} active · oldest ${formatDurationHours(rm.current_max_time_in_queue_hours)}`
              : "No items in replenishment queue",
          tone: "text-violet-800 dark:text-violet-300",
        },
        {
          label: "Avg time in queue (all)",
          value: formatDurationHours(rm.avg_time_in_queue_hours),
          icon: Clock,
          sub:
            rm.completed_cycles_count > 0
              ? `${rm.completed_cycles_count} completed cycles`
              : "Recorded when queue is cleared or stock recovers",
          tone: "text-violet-800 dark:text-violet-300",
        },
        {
          label: "Avg low → replenish",
          value: formatDurationHours(rm.avg_time_to_replenish_hours),
          icon: TrendingUp,
          sub: "Low stock until quantity above minimum",
          tone: "text-indigo-800 dark:text-indigo-300",
        },
        {
          label: `Replenish (${rm.yoy.current_year})`,
          value: formatDurationHours(rm.yoy.avg_time_to_replenish_hours_current),
          icon: TrendingUp,
          sub:
            formatYoyReplenishChange(rm.yoy.change_pct) ??
            (rm.yoy.completed_cycles_current_year > 0
              ? `${rm.yoy.completed_cycles_current_year} cycles this year`
              : `No completed cycles in ${rm.yoy.current_year} yet`),
          tone: "text-indigo-800 dark:text-indigo-300",
        },
        {
          label: `Replenish (${rm.yoy.prior_year})`,
          value: formatDurationHours(rm.yoy.avg_time_to_replenish_hours_prior),
          icon: TrendingUp,
          sub:
            rm.yoy.completed_cycles_prior_year > 0
              ? `${rm.yoy.completed_cycles_prior_year} cycles · YoY baseline`
              : "Prior-year baseline for comparison",
          tone: "text-slate-700 dark:text-slate-300",
        },
      ]
    : [];

  return [
    {
      label: "Total items",
      value: summary.total_items,
      icon: Package,
      sub: null,
      tone: "text-ds-accent",
    },
    {
      label: "In stock",
      value: summary.in_stock,
      icon: Box,
      sub: null,
      tone: "text-[#3182ce]",
    },
    {
      label: "Low stock",
      value: summary.low_stock,
      icon: AlertTriangle,
      sub: summary.low_stock > 0 ? "Review thresholds" : null,
      tone: "text-amber-800",
      alert: summary.low_stock > 0,
    },
    ...([0, 1, 2] as const).map((i) => {
      const row = summary.most_used?.[i];
      return {
        label: `Top ${i + 1} by uses`,
        value: row ? row.usage_count.toLocaleString() : "—",
        icon: TrendingUp,
        sub: row ? `${row.name}${row.sku ? ` · ${row.sku}` : ""}` : "No logged usage yet",
        tone: "text-emerald-800 dark:text-emerald-400/90",
      };
    }),
    {
      label: "Inventory value",
      value: summary.estimated_value != null ? `$${summary.estimated_value.toLocaleString()}` : "—",
      icon: ClipboardList,
      sub: "Qty × unit cost",
      tone: "text-slate-800",
    },
    ...replenishCards,
  ];
}

type Props = {
  summary: InventorySummary | null;
  loading?: boolean;
};

export function InventoryAnalyticsPanel({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center text-sm text-pulse-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading analytics…
      </div>
    );
  }

  if (!summary) {
    return <p className="text-sm text-pulse-muted">No inventory data yet.</p>;
  }

  const cards = buildMetricCards(summary);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-pulse-navy dark:text-gray-100">Inventory analytics</h2>
        <p className="mt-1 text-sm text-pulse-muted">
          Stock levels, usage leaders, estimated value, and replenishment queue timing across your catalog.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn(
              "flex min-w-0 flex-col rounded-md border bg-white p-3 shadow-sm ring-1 dark:bg-ds-primary dark:shadow-[0_2px_8px_rgba(0,0,0,0.35)] sm:p-4",
              card.alert
                ? "border-amber-200 ring-amber-100/90 dark:border-amber-500/35 dark:ring-amber-500/20"
                : "border-pulse-border ring-slate-100/80 dark:border-ds-border dark:ring-white/[0.06]",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase leading-tight tracking-wide text-pulse-muted sm:text-xs">
                <span className="sm:hidden">{inventoryMetricShortLabel(card.label)}</span>
                <span className="hidden sm:inline">{card.label}</span>
              </p>
              <card.icon className={cn("h-4 w-4 shrink-0 opacity-80 sm:h-5 sm:w-5", card.tone)} aria-hidden />
            </div>
            <p className="mt-2 text-xl font-bold tabular-nums tracking-tight text-pulse-navy dark:text-gray-100 sm:text-2xl">
              {card.value}
            </p>
            {card.sub ? (
              <p
                className={cn(
                  "mt-1 line-clamp-2 text-[11px] font-semibold sm:text-xs",
                  card.alert ? "text-rose-600" : "text-pulse-muted",
                )}
              >
                {card.sub}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="rounded-md border border-pulse-border bg-slate-50/80 p-4 text-sm text-pulse-muted dark:border-ds-border dark:bg-ds-secondary/30">
        <p className="font-semibold text-pulse-navy dark:text-gray-200">About these metrics</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Status counts reflect current item records, not filtered list views.</li>
          <li>Top items rank by logged usage from work requests and transactions.</li>
          <li>Inventory value sums quantity × unit cost where unit cost is set.</li>
          <li>
            Queue timing tracks active replenishment rows now, and averages from completed cycles when you clear
            the queue or stock is received back above minimum.
          </li>
          <li>
            Year-over-year replenish compares average low-stock-to-restock duration for the current calendar year
            vs the prior year.
          </li>
        </ul>
      </div>
    </div>
  );
}
