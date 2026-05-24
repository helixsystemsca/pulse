import type { WidgetHeightTier } from "@/lib/dashboard/workspace-layout";

/**
 * Operations dashboard tiles stretch inner cards and list rows to the widget body.
 * Height tier still controls disclosure (extra sections), not whether content fills.
 */
export function opsWidgetFillLayout(_tier?: WidgetHeightTier): boolean {
  return true;
}

/** Applied to every {@link OpsWidgetShell} body on the operations dashboard. */
export const OPS_WIDGET_BODY_CLASS =
  "ops-dash-widget-body--fill !overflow-hidden !p-1.5 flex min-h-0 flex-1 flex-col items-stretch w-full min-w-0";
