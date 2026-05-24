"use client";

import { Package } from "lucide-react";

import type { DashboardViewModel } from "@/components/dashboard/OperationalDashboard";
import type { DashboardWidgetRenderContext } from "@/lib/dashboard/render-context";
import { opsWidgetFillLayout } from "@/lib/dashboard/ops-widget-fill";
import { cn } from "@/lib/cn";

export function LowInventoryOpsWidget({
  model,
  layoutContext,
}: {
  model: DashboardViewModel;
  layoutContext?: DashboardWidgetRenderContext | null;
}) {
  const fillRows = opsWidgetFillLayout(layoutContext?.heightTier);
  const items = model.inventory.shoppingList;

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="ops-dash-inner-card flex min-h-0 flex-1 flex-col gap-1.5 p-1.5">
      <div
        className={cn(
          "flex shrink-0 items-start justify-between gap-2 rounded-lg px-2.5",
          fillRows ? "py-2.5" : "py-2",
          model.inventory.consumablesOk
            ? "bg-[color-mix(in_srgb,var(--ds-success)_10%,transparent)]"
            : "bg-[color-mix(in_srgb,var(--ds-text-primary)_4%,transparent)]",
        )}
      >
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]",
              fillRows ? "text-sm" : "text-xs",
            )}
          >
            Consumables
          </p>
          <p
            className={cn(
              "text-[color-mix(in_srgb,var(--ds-text-primary)_56%,transparent)]",
              fillRows ? "mt-1 text-xs" : "mt-0.5 text-[11px]",
            )}
          >
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
        <div
          className={cn(
            "ops-dash-alert-card mt-1.5 flex shrink-0 gap-2 px-2.5",
            fillRows ? "py-2.5" : "py-2",
          )}
        >
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ds-warning)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
              {model.inventory.alert.category}
            </p>
            <p className="mt-0.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]">
              {model.inventory.alert.message}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-1.5 flex min-h-0 flex-1 flex-col">
        <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
          Low stock list
        </p>

        {items.length === 0 ? (
          <p
            className={cn(
              "flex flex-1 items-center justify-center text-center text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]",
              fillRows ? "text-sm" : "mt-2 text-xs",
            )}
          >
            Nothing flagged.
          </p>
        ) : (
          <ul
            className={cn(
              "mt-1.5 flex min-h-0 flex-1 flex-col",
              fillRows ? "justify-between gap-2" : "gap-1.5 overflow-y-auto pr-0.5",
            )}
          >
            {items.map((item) => (
              <li
                key={item}
                className={cn(
                  "flex min-h-0 items-center gap-2 rounded-full border border-[rgb(226_232_240/0.8)] bg-[linear-gradient(90deg,#ffffff,#f8fafc)] px-2.5 font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)] shadow-[0_1px_0_rgb(255_255_255)_inset,0_3px_10px_-6px_rgb(15_23_42/0.08)]",
                  fillRows ? "flex-1 py-2.5 text-sm" : "shrink-0 py-1.5 text-xs",
                )}
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ds-warning)]" aria-hidden />
                <span className="min-w-0 truncate">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    </div>
  );
}
