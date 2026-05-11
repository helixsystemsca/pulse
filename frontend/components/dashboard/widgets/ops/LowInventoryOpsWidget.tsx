"use client";

import Link from "next/link";
import { Package } from "lucide-react";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import { pulseTenantNav } from "@/lib/pulse-app";
import { cn } from "@/lib/cn";

export function LowInventoryOpsWidget({ model }: { model: DashboardViewModel }) {
  const invHref = pulseTenantNav.find((n) => n.href === "/dashboard/inventory")?.href ?? "/dashboard/inventory";

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-[color-mix(in_srgb,var(--ops-dash-widget-bg,#fff)_65%,var(--ops-dash-border,#cbd5e1))] bg-[var(--ops-dash-widget-bg,#ffffff)] p-3 shadow-sm dark:border-white/[0.07] dark:bg-[color-mix(in_srgb,#0f172a_96%,#1e293b)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">Consumables</p>
          <p className="mt-0.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]">
            {model.inventory.consumablesOk ? "Within target range" : "Needs attention"}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
            model.inventory.consumablesOk
              ? "bg-[color-mix(in_srgb,var(--ds-success)_18%,transparent)] text-emerald-900 dark:text-emerald-100"
              : "bg-[color-mix(in_srgb,var(--ds-info)_18%,transparent)] text-[var(--ds-info)]",
          )}
        >
          {model.inventory.consumablesOk ? "OK" : "Review"}
        </span>
      </div>

      {model.inventory.alert ? (
        <div className="mb-3 flex gap-2 rounded-lg border border-[color-mix(in_srgb,var(--ds-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--ds-warning)_10%,transparent)] px-2.5 py-2">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-warning)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{model.inventory.alert.category}</p>
            <p className="mt-0.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]">{model.inventory.alert.message}</p>
            <Link href={invHref} className="mt-2 inline-block text-[11px] font-semibold text-[var(--ds-accent)] underline-offset-2 hover:underline">
              View inventory →
            </Link>
          </div>
        </div>
      ) : null}

      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">Low stock list</p>
      {model.inventory.shoppingList.length === 0 ? (
        <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">Nothing flagged.</p>
      ) : (
        <ul className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-auto pr-0.5">
          {model.inventory.shoppingList.map((item) => (
            <li key={item} className="flex items-center gap-2 rounded-md bg-[color-mix(in_srgb,var(--ds-text-primary)_5%,transparent)] px-2 py-1.5 text-xs font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ds-warning)]" aria-hidden />
              <span className="min-w-0 truncate">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
