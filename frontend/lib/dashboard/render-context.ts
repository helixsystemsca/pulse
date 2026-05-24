import type { LayoutItem } from "react-grid-layout";
import { getWidgetMode, type WidgetMode, type WidgetRenderContext } from "@/components/dashboard/widgets/widgetSizing";
import {
  gridUnitsToLogicalTile,
  gridUnitsToTile,
  widgetPixelSizeFromGridUnits,
} from "@/lib/dashboard/tile-grid";
import {
  DASHBOARD_GRID_COLS,
  DASHBOARD_GRID_GAP_PX,
  DASHBOARD_GRID_ROW_HEIGHT_PX,
} from "@/lib/dashboard/tokens";

export type DashboardWidgetRenderContext = WidgetRenderContext & {
  /** Logical tile width (1 = base tile). */
  logicalW: number;
  /** Logical tile height. */
  logicalH: number;
  /** Atomic tile footprint. */
  tileW: number;
  tileH: number;
};

export function buildWidgetRenderContext(
  item: LayoutItem,
  gridWidthPx: number,
  cols = DASHBOARD_GRID_COLS,
): DashboardWidgetRenderContext {
  const w = item.w ?? 1;
  const h = item.h ?? 1;
  const { widthPx, heightPx } = widgetPixelSizeFromGridUnits({
    gridWidthPx,
    cols,
    w,
    h,
    rowHeight: DASHBOARD_GRID_ROW_HEIGHT_PX,
    gap: DASHBOARD_GRID_GAP_PX,
  });
  const tile = gridUnitsToTile(w, h);
  const logical = gridUnitsToLogicalTile(w, h);
  const mode: WidgetMode = getWidgetMode({
    gridW: logical.lw,
    gridH: logical.lh,
    widthPx,
    heightPx,
  });
  return {
    mode,
    gridW: logical.lw,
    gridH: logical.lh,
    widthPx,
    heightPx,
    logicalW: logical.lw,
    logicalH: logical.lh,
    tileW: tile.tw,
    tileH: tile.th,
  };
}
