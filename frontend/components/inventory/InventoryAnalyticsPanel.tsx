"use client";

import {
  AlertTriangle,
  Box,
  ClipboardList,
  Loader2,
  Package,
  TrendingUp,
} from "lucide-react";
import type { InventorySummary } from "@/lib/inventoryService";
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
  const top = /^Top (\d) by uses$/.exec(label);
  if (top) return `Top ${top[1]}`;
  return label;
}

function buildMetricCards(summary: InventorySummary): MetricCard[] {
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
          Stock levels, usage leaders, and estimated value across your catalog.
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
        </ul>
      </div>
    </div>
  );
}
