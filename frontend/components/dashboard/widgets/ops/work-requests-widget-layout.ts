import type { LayoutItem } from "react-grid-layout";

/** Explicit work-requests widget grid presets (resize the grid, not the KPI cards). */
export type WorkRequestsLayoutMode = "4x1" | "2x2" | "1x4";

export const WORK_REQUESTS_WIDGET_ID = "notifications_work_orders";

export type WorkRequestsGridPreset = {
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxH: number;
};

/** Target grid units per layout mode (16-col dashboard). */
export const WORK_REQUESTS_GRID_BY_MODE: Record<WorkRequestsLayoutMode, WorkRequestsGridPreset> = {
  /** Compact horizontal strip — ~half prior default height. */
  "4x1": { w: 6, h: 2, minW: 4, minH: 2, maxH: 2 },
  "2x2": { w: 4, h: 4, minW: 3, minH: 4, maxH: 5 },
  "1x4": { w: 3, h: 8, minW: 2, minH: 6, maxH: 10 },
};

/**
 * Infer layout mode from current grid units while resizing (live preview).
 * Snapping to {@link WORK_REQUESTS_GRID_BY_MODE} happens on resize stop.
 */
export function detectWorkRequestsLayoutMode(gridW: number, gridH: number): WorkRequestsLayoutMode {
  const w = Math.max(1, Math.floor(gridW));
  const h = Math.max(1, Math.floor(gridH));
  const ratio = w / h;

  if (h >= 5 && ratio < 1.05) return "1x4";
  if (w >= 3 && h >= 3 && ratio >= 0.82 && ratio <= 1.35) return "2x2";
  return "4x1";
}

export function workRequestsLayoutModeFromContext(gridW: number, gridH: number): WorkRequestsLayoutMode {
  return detectWorkRequestsLayoutMode(gridW, gridH);
}

/** Apply snapped w/h + min/max constraints for react-grid-layout. */
export function snapWorkRequestsGridItem(item: LayoutItem, cols = 16): LayoutItem {
  const mode = detectWorkRequestsLayoutMode(item.w ?? 6, item.h ?? 2);
  const preset = WORK_REQUESTS_GRID_BY_MODE[mode];
  const w = Math.max(preset.minW, Math.min(preset.w, cols));
  return {
    ...item,
    w,
    h: preset.h,
    minW: preset.minW,
    minH: preset.minH,
    maxH: preset.maxH,
  };
}
