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

  // XS: tight telemetry / KPI slots (logical tile counts).
  if (areaUnits <= 2 || minSide < 180) return "xs";

  // SM: compact but usable.
  if (areaUnits <= 4 || minSide < 260) return "sm";

  // MD: default operational view.
  if (areaUnits <= 9 || areaPx < 480 * 280) return "md";

  // LG: room for trends / supporting metadata.
  if (areaUnits <= 16 || areaPx < 680 * 380) return "lg";

  return "xl";
}

