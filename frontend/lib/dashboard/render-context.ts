import type { WidgetZoneClass, WidgetHeightTier, WorkspaceColumnId, WorkspaceWidgetSlot } from "@/lib/dashboard/workspace-layout";
import { columnWidthPx, isStackedWorkspaceLayout, WIDGET_HEIGHT_TIER_MIN_PX } from "@/lib/dashboard/workspace-layout";
import { getWidgetMode, type WidgetMode, type WidgetRenderContext } from "@/components/dashboard/widgets/widgetSizing";
import { DASHBOARD_WIDGET_HEADER_HEIGHT_PX } from "@/lib/dashboard/tokens";

export type DashboardWidgetRenderContext = WidgetRenderContext & {
  zone: WidgetZoneClass;
  column: WorkspaceColumnId;
  heightTier: WidgetHeightTier;
  logicalW: number;
  logicalH: number;
};

const TIER_LOGICAL_H: Record<WidgetHeightTier, number> = {
  compact: 1,
  medium: 2,
  expanded: 3,
  tall: 4,
};

export function buildWorkspaceRenderContext(
  slot: WorkspaceWidgetSlot,
  column: WorkspaceColumnId,
  containerWidthPx: number,
): DashboardWidgetRenderContext {
  const zone: WidgetZoneClass = column === "hero" ? "hero" : "edge";
  const stacked = isStackedWorkspaceLayout(containerWidthPx);
  const widthPx = columnWidthPx(containerWidthPx, column);
  const bodyPx = WIDGET_HEIGHT_TIER_MIN_PX[slot.heightTier];
  const heightPx = bodyPx + DASHBOARD_WIDGET_HEADER_HEIGHT_PX;
  const logicalW = stacked ? 2 : zone === "hero" ? 2 : 1;
  const logicalH = TIER_LOGICAL_H[slot.heightTier];
  const mode: WidgetMode = getWidgetMode({
    gridW: logicalW,
    gridH: logicalH,
    widthPx,
    heightPx,
  });
  return {
    mode,
    gridW: logicalW,
    gridH: logicalH,
    widthPx,
    heightPx,
    zone,
    column,
    heightTier: slot.heightTier,
    logicalW,
    logicalH,
  };
}

/** @deprecated Grid layout context — use buildWorkspaceRenderContext */
export function buildWidgetRenderContext(): never {
  throw new Error("buildWidgetRenderContext is deprecated; use buildWorkspaceRenderContext");
}
