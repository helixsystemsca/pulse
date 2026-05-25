/**
 * Canonical dashboard layout tokens — single source of truth for grid rhythm and widget chrome.
 * Widgets must inherit these values; no widget-specific spacing systems.
 */

/** Target height of one logical dashboard tile (px). */
export const DASHBOARD_BASE_TILE_HEIGHT_PX = 180;

/** react-grid-layout row height (px). Four rows + three gaps ≈ 180px logical tile. */
export const DASHBOARD_GRID_ROW_HEIGHT_PX = 36;

/** Grid gutter between cells (px). */
export const DASHBOARD_GRID_GAP_PX = 12;

/** Inner widget body padding (px). */
export const DASHBOARD_WIDGET_PADDING_PX = 8;

/** Widget header bar height (px). */
export const DASHBOARD_WIDGET_HEADER_HEIGHT_PX = 36;

/** Widget corner radius (px). */
export const DASHBOARD_WIDGET_RADIUS_PX = 12;

/** Layout transition duration (ms). */
export const DASHBOARD_LAYOUT_TRANSITION_MS = 180;

/** Fine-grained column count — one RGL column = one atomic unit. */
export const DASHBOARD_GRID_COLS = 24;

/** Atomic columns per logical tile (24 cols ÷ 4 logical columns). */
export const DASHBOARD_LOGICAL_TILE_COL_SPAN = 6;

/** Atomic rows per logical tile (4 rows × 36px + 3 gaps × 12px = 180px). */
export const DASHBOARD_LOGICAL_TILE_ROW_SPAN = 4;

/** One RGL column / row = one atomic unit. */
export const TILE_UNIT_COLS = 1;
export const TILE_UNIT_ROWS = 1;

export const DASHBOARD_TILE_COLS = DASHBOARD_GRID_COLS;

/** Layout persistence version — bump when grid semantics change. */
export const DASHBOARD_LAYOUT_STORAGE_VERSION = 11;

export const DASHBOARD_TOKENS = {
  baseTileHeightPx: DASHBOARD_BASE_TILE_HEIGHT_PX,
  gridRowHeightPx: DASHBOARD_GRID_ROW_HEIGHT_PX,
  gridGapPx: DASHBOARD_GRID_GAP_PX,
  widgetPaddingPx: DASHBOARD_WIDGET_PADDING_PX,
  headerHeightPx: DASHBOARD_WIDGET_HEADER_HEIGHT_PX,
  widgetRadiusPx: DASHBOARD_WIDGET_RADIUS_PX,
  layoutTransitionMs: DASHBOARD_LAYOUT_TRANSITION_MS,
  gridCols: DASHBOARD_GRID_COLS,
  logicalTileColSpan: DASHBOARD_LOGICAL_TILE_COL_SPAN,
  logicalTileRowSpan: DASHBOARD_LOGICAL_TILE_ROW_SPAN,
} as const;
