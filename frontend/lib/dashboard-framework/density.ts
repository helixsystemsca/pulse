import type { WidgetDensity } from "@/lib/dashboard-framework/types";

export function densityForWidgetSize({
  w,
  h,
  kiosk,
}: {
  w: number;
  h: number;
  kiosk: boolean;
}): WidgetDensity {
  const area = Math.max(1, Math.round(w)) * Math.max(1, Math.round(h));

  // Kiosk mode biases toward higher density since the display is intentionally information-rich.
  const bump = kiosk ? 1 : 0;

  const level = area <= 2 ? 0 : area <= 6 ? 1 : area <= 12 ? 2 : 3;
  const idx = Math.max(0, Math.min(3, level + bump));

  return idx === 0 ? "compact" : idx === 1 ? "standard" : idx === 2 ? "expanded" : "xl";
}

