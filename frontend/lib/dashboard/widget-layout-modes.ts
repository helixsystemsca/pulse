import type { WorkRequestsLayoutMode } from "@/lib/dashboard/snap/work-requests";
import type { WidgetHeightTier, WidgetZoneClass } from "@/lib/dashboard/workspace-layout";
import { WIDGET_HEIGHT_TIER_MIN_PX } from "@/lib/dashboard/workspace-layout";
import type { WidgetMode } from "@/components/dashboard/widgets/widgetSizing";
import { DASHBOARD_WIDGET_PADDING_PX } from "@/lib/dashboard/tokens";

export type ComplianceRadialSize = "sm" | "md" | "lg" | "xl";

export type ElasticListLimits = {
  maxItems: number;
  showSecondary: boolean;
  showFooter: boolean;
  spacious: boolean;
};

/** Map workspace height tier → legacy widget mode bands. */
export function modeFromHeightTier(tier: WidgetHeightTier, zone: WidgetZoneClass = "edge"): WidgetMode {
  if (tier === "compact") return "xs";
  if (tier === "medium") return "sm";
  if (tier === "expanded") return zone === "hero" ? "lg" : "md";
  return zone === "hero" ? "xl" : "lg";
}

export function trainingRadialSize(tier: WidgetHeightTier): ComplianceRadialSize {
  if (tier === "compact") return "sm";
  if (tier === "medium") return "md";
  if (tier === "expanded") return "lg";
  return "xl";
}

export function trainingUsesRowLayout(tier: WidgetHeightTier): boolean {
  return tier === "expanded" || tier === "tall";
}

export function workRequestsLayoutForTier(tier: WidgetHeightTier): WorkRequestsLayoutMode {
  if (tier === "tall") return "1x4";
  if (tier === "expanded") return "2x2";
  return "4x1";
}

export type WorkRequestsKpiMetrics = {
  layoutMode: WorkRequestsLayoutMode;
  cellPx: number;
  gapPx: number;
};

/** Proportional KPI cell sizing from tier + available body box. */
export function workRequestsKpiMetrics(
  tier: WidgetHeightTier,
  bodyWidthPx: number,
  bodyHeightPx: number,
): WorkRequestsKpiMetrics {
  const layoutMode = workRequestsLayoutForTier(tier);
  const rows = layoutMode === "4x1" ? 1 : layoutMode === "2x2" ? 2 : 4;
  const cols = layoutMode === "4x1" ? 4 : layoutMode === "2x2" ? 2 : 1;
  const gapPx = tier === "compact" ? 6 : tier === "medium" ? 8 : 10;
  const pad = DASHBOARD_WIDGET_PADDING_PX * 2;
  const w = Math.max(0, bodyWidthPx - pad);
  const h = Math.max(0, bodyHeightPx);
  const byHeight = rows > 0 ? Math.floor((h - (rows - 1) * gapPx) / rows) : 64;
  const byWidth = cols > 0 ? Math.floor((w - (cols - 1) * gapPx) / cols) : 64;
  const tierFloor = tier === "compact" ? 56 : tier === "medium" ? 64 : tier === "expanded" ? 72 : 80;
  const tierCeil = tier === "compact" ? 72 : tier === "medium" ? 88 : tier === "expanded" ? 104 : 120;
  const cellPx = Math.max(tierFloor, Math.min(tierCeil, byHeight, byWidth));
  return { layoutMode, cellPx, gapPx };
}

export function co2TankVariant(tier: WidgetHeightTier): "compact" | "standard" {
  return tier === "compact" || tier === "medium" ? "compact" : "standard";
}

export function co2TankScaleCss(tier: WidgetHeightTier): number {
  if (tier === "compact") return 1;
  if (tier === "medium") return 1.15;
  if (tier === "expanded") return 1.35;
  return 1.55;
}

export function elasticListLimits(tier: WidgetHeightTier): ElasticListLimits {
  if (tier === "compact") {
    return { maxItems: 3, showSecondary: false, showFooter: false, spacious: false };
  }
  if (tier === "medium") {
    return { maxItems: 4, showSecondary: false, showFooter: false, spacious: false };
  }
  if (tier === "expanded") {
    return { maxItems: 6, showSecondary: true, showFooter: true, spacious: true };
  }
  return { maxItems: 10, showSecondary: true, showFooter: true, spacious: true };
}

export function routineAssignmentLimits(tier: WidgetHeightTier): {
  compact: boolean;
  maxAssignments: number;
  maxRoutines: number;
} {
  if (tier === "compact") return { compact: true, maxAssignments: 2, maxRoutines: 2 };
  if (tier === "medium") return { compact: false, maxAssignments: 4, maxRoutines: 3 };
  if (tier === "expanded") return { compact: false, maxAssignments: 6, maxRoutines: 5 };
  return { compact: false, maxAssignments: 10, maxRoutines: 8 };
}

export function facilityScheduleLimits(tier: WidgetHeightTier): {
  compact: boolean;
  maxLocations: number;
  maxPerLocation: number;
} {
  if (tier === "compact") return { compact: true, maxLocations: 2, maxPerLocation: 2 };
  if (tier === "medium") return { compact: false, maxLocations: 3, maxPerLocation: 4 };
  if (tier === "expanded") return { compact: false, maxLocations: 5, maxPerLocation: 6 };
  return { compact: false, maxLocations: 8, maxPerLocation: 10 };
}

export function workforceTierFlags(tier: WidgetHeightTier): {
  showRoster: boolean;
  showCountStrip: boolean;
  showSecondaryBands: boolean;
  avatarScale: number;
} {
  if (tier === "compact") {
    return { showRoster: false, showCountStrip: true, showSecondaryBands: false, avatarScale: 0.92 };
  }
  if (tier === "medium") {
    return { showRoster: true, showCountStrip: false, showSecondaryBands: false, avatarScale: 1 };
  }
  if (tier === "expanded") {
    return { showRoster: true, showCountStrip: true, showSecondaryBands: false, avatarScale: 1.08 };
  }
  return { showRoster: true, showCountStrip: true, showSecondaryBands: true, avatarScale: 1.15 };
}

export function widgetBodyHeightPx(tier: WidgetHeightTier): number {
  return WIDGET_HEIGHT_TIER_MIN_PX[tier];
}
