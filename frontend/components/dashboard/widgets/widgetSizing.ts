export type WidgetMode = "xs" | "sm" | "md" | "lg" | "xl";

export type WidgetRenderContext = {
  mode: WidgetMode;
  gridW: number;
  gridH: number;
  widthPx: number;
  heightPx: number;
};

/**
 * Determine an adaptive mode from available widget space.
 *
 * Pass **logical tile** counts (`gridW` / `gridH` = tw / th from `tile-grid`) so modes
 * align with discrete footprints (1×1, 2×1, 2×2, …), not raw react-grid-layout units.
 *
 * Modes are intentionally "sticky" (wide bands) to avoid thrash while resizing.
 */
export function getWidgetMode({
  gridW,
  gridH,
  widthPx,
  heightPx,
}: {
  gridW: number;
  gridH: number;
  widthPx: number;
  heightPx: number;
}): WidgetMode {
  const w = Math.max(1, Math.floor(gridW));
  const h = Math.max(1, Math.floor(gridH));
  const areaUnits = w * h;
  const minSide = Math.min(Math.max(0, widthPx), Math.max(0, heightPx));
  const areaPx = Math.max(0, widthPx) * Math.max(0, heightPx);

  // XS: small tiles / tight slots where scrollbars look bad.
  if (areaUnits <= 8 || minSide < 220) return "xs";

  // SM: compact but usable (headline + a couple rows).
  if (areaUnits <= 14 || minSide < 300) return "sm";

  // MD: default operational view for most widgets.
  if (areaUnits <= 24 || areaPx < 520 * 320) return "md";

  // LG: room for trends / supporting metadata.
  if (areaUnits <= 40 || areaPx < 760 * 420) return "lg";

  return "xl";
}

