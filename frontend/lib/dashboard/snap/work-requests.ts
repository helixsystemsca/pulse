import type { LayoutItem } from "react-grid-layout";
import {
  DASHBOARD_GRID_GAP_PX,
  DASHBOARD_GRID_ROW_HEIGHT_PX,
  DASHBOARD_WIDGET_HEADER_HEIGHT_PX,
} from "@/lib/dashboard/tokens";

/** Explicit work-requests widget grid presets (resize the grid, not the KPI cards). */
export type WorkRequestsLayoutMode = "4x1" | "2x2" | "1x4";

export const WORK_REQUESTS_WIDGET_ID = "notifications_work_orders";

/** Fixed square KPI size (px) — widget grid spans are derived from this, not the other way around. */
export const WORK_REQUESTS_KPI_CELL_PX = 64;
export const WORK_REQUESTS_KPI_GAP_PX = 6;
/** Header row inside the widget shell (matches dashboard token). */
export const WORK_REQUESTS_SHELL_HEADER_PX = DASHBOARD_WIDGET_HEADER_HEIGHT_PX;

export type WorkRequestsGridPreset = {
  mode: WorkRequestsLayoutMode;
  w: number;
  h: number;
  minW: number;
  minH: number;
  maxH: number;
  maxW?: number;
};

function contentHeightPx(mode: WorkRequestsLayoutMode): number {
  const rows = mode === "4x1" ? 1 : mode === "2x2" ? 2 : 4;
  return rows * WORK_REQUESTS_KPI_CELL_PX + (rows - 1) * WORK_REQUESTS_KPI_GAP_PX;
}

function shellHeightPx(mode: WorkRequestsLayoutMode): number {
  return WORK_REQUESTS_SHELL_HEADER_PX + contentHeightPx(mode);
}

/** Grid row count so the shell fits KPI cards with no extra vertical slack. */
export function gridHForMode(mode: WorkRequestsLayoutMode): number {
  const shellH = shellHeightPx(mode);
  return Math.max(
    1,
    Math.ceil((shellH + DASHBOARD_GRID_GAP_PX) / (DASHBOARD_GRID_ROW_HEIGHT_PX + DASHBOARD_GRID_GAP_PX)),
  );
}

function kpiContentWidthPx(mode: WorkRequestsLayoutMode): number {
  const cols = mode === "4x1" ? 4 : mode === "2x2" ? 2 : 1;
  return cols * WORK_REQUESTS_KPI_CELL_PX + (cols - 1) * WORK_REQUESTS_KPI_GAP_PX;
}

function gridColWidthPx(gridWidthPx: number, cols: number): number {
  const safeCols = Math.max(1, cols);
  return (Math.max(0, gridWidthPx) - DASHBOARD_GRID_GAP_PX * (safeCols - 1)) / safeCols;
}

function gridWForContentPx(contentPx: number, gridWidthPx: number, cols: number): number {
  const colW = gridColWidthPx(gridWidthPx, cols);
  const gap = DASHBOARD_GRID_GAP_PX;
  if (colW <= 0) return 2;
  return Math.max(1, Math.ceil((contentPx + gap) / (colW + gap)));
}

function gridWForMode(mode: WorkRequestsLayoutMode, gridWidthPx?: number, cols = 24): number {
  const contentW = kpiContentWidthPx(mode);
  if (gridWidthPx != null && gridWidthPx > 0) {
    const w = gridWForContentPx(contentW, gridWidthPx, cols);
    if (mode === "1x4") return Math.min(5, Math.max(3, w));
    if (mode === "2x2") return Math.min(8, Math.max(5, w));
    return Math.min(cols, Math.max(7, w));
  }
  if (mode === "1x4") return 4;
  if (mode === "2x2") return 6;
  return 8;
}

export function buildWorkRequestsGridPreset(
  mode: WorkRequestsLayoutMode,
  gridWidthPx?: number,
  cols = 24,
): WorkRequestsGridPreset {
  const h = gridHForMode(mode);
  const w = gridWForMode(mode, gridWidthPx, cols);
  return { mode, w, h, minW: w, minH: h, maxH: h, maxW: w };
}

export function detectWorkRequestsLayoutMode(gridW: number, gridH: number): WorkRequestsLayoutMode {
  const w = Math.max(1, Math.floor(gridW));
  const h = Math.max(1, Math.floor(gridH));
  const ratio = w / h;
  const h4 = gridHForMode("4x1");
  const h22 = gridHForMode("2x2");
  const h14 = gridHForMode("1x4");

  if (h >= h14 - 1 && w <= 5) return "1x4";
  if (h >= h14 - 1 && ratio < 0.45) return "1x4";
  if (h <= h4 + 0.5 && ratio >= 1.05) return "4x1";
  if (h >= h22 - 0.5 && h <= h22 + 1.5 && ratio >= 0.55 && ratio <= 1.35) return "2x2";
  if (h >= h14 - 1) return "1x4";
  if (h <= h4 + 0.5) return "4x1";
  return "2x2";
}

export function workRequestsLayoutModeFromContext(gridW: number, gridH: number): WorkRequestsLayoutMode {
  return detectWorkRequestsLayoutMode(gridW, gridH);
}

export function snapWorkRequestsGridItem(
  item: LayoutItem,
  cols = 24,
  gridWidthPx?: number,
): LayoutItem {
  const mode = detectWorkRequestsLayoutMode(item.w ?? 6, item.h ?? gridHForMode("4x1"));
  const preset = buildWorkRequestsGridPreset(mode, gridWidthPx, cols);
  return {
    ...item,
    w: preset.w,
    h: preset.h,
    minW: preset.w,
    minH: preset.h,
    maxH: preset.h,
    maxW: preset.w,
  };
}
