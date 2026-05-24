import {
  DASHBOARD_LOGICAL_TILE_COL_SPAN,
  DASHBOARD_LOGICAL_TILE_ROW_SPAN,
} from "@/lib/dashboard/tokens";
import { WORK_REQUESTS_WIDGET_ID } from "@/lib/dashboard/snap/work-requests";

export type DashboardWidgetArchetype = "kpi" | "elastic" | "workspace";

export type LogicalTileFootprint = {
  /** Width in logical tile units (1 = one base tile wide). */
  lw: number;
  /** Height in logical tile units. */
  lh: number;
};

export type AtomicTileFootprint = {
  tw: number;
  th: number;
};

export type TileFootprintShape = "1x1" | "1x2" | "2x1" | "2x2" | "wide" | "tall" | "large";

export function logicalToAtomic({ lw, lh }: LogicalTileFootprint): AtomicTileFootprint {
  return {
    tw: lw * DASHBOARD_LOGICAL_TILE_COL_SPAN,
    th: lh * DASHBOARD_LOGICAL_TILE_ROW_SPAN,
  };
}

export function atomicToLogical({ tw, th }: AtomicTileFootprint): LogicalTileFootprint {
  return {
    lw: Math.max(1, Math.round(tw / DASHBOARD_LOGICAL_TILE_COL_SPAN)),
    lh: Math.max(1, Math.round(th / DASHBOARD_LOGICAL_TILE_ROW_SPAN)),
  };
}

export function tileFootprintShape({ tw, th }: AtomicTileFootprint): TileFootprintShape {
  const { lw, lh } = atomicToLogical({ tw, th });
  if (lw >= 4 && lh >= 3) return "large";
  if (lw === 1 && lh === 1) return "1x1";
  if (lw === 1 && lh === 2) return "1x2";
  if (lw === 2 && lh === 1) return "2x1";
  if (lw === 2 && lh === 2) return "2x2";
  if (lw > lh * 1.35) return "wide";
  if (lh > lw * 1.35) return "tall";
  return "2x2";
}

/** KPI / telemetry — morph-only between compact footprints. */
export const KPI_LOGICAL_FOOTPRINTS: LogicalTileFootprint[] = [
  { lw: 1, lh: 1 },
  { lw: 1, lh: 2 },
  { lw: 2, lh: 1 },
  { lw: 2, lh: 2 },
];

/** Elastic data — gains utility from expansion. */
export const ELASTIC_LOGICAL_FOOTPRINTS: LogicalTileFootprint[] = [
  { lw: 2, lh: 2 },
  { lw: 2, lh: 3 },
  { lw: 3, lh: 2 },
  { lw: 3, lh: 3 },
  { lw: 4, lh: 2 },
  { lw: 4, lh: 3 },
];

/** Workspace — viewport-first, large footprints. */
export const WORKSPACE_LOGICAL_FOOTPRINTS: LogicalTileFootprint[] = [
  { lw: 4, lh: 2 },
  { lw: 4, lh: 3 },
  { lw: 4, lh: 4 },
];

export const CUSTOM_PEEK_LOGICAL_FOOTPRINTS: LogicalTileFootprint[] = [
  { lw: 2, lh: 2 },
  { lw: 2, lh: 3 },
  { lw: 3, lh: 2 },
  { lw: 3, lh: 3 },
];

function toAtomicFootprints(logical: LogicalTileFootprint[]): AtomicTileFootprint[] {
  return logical.map(logicalToAtomic);
}

export const KPI_ATOMIC_FOOTPRINTS = toAtomicFootprints(KPI_LOGICAL_FOOTPRINTS);
export const ELASTIC_ATOMIC_FOOTPRINTS = toAtomicFootprints(ELASTIC_LOGICAL_FOOTPRINTS);
export const WORKSPACE_ATOMIC_FOOTPRINTS = toAtomicFootprints(WORKSPACE_LOGICAL_FOOTPRINTS);
export const CUSTOM_PEEK_ATOMIC_FOOTPRINTS = toAtomicFootprints(CUSTOM_PEEK_LOGICAL_FOOTPRINTS);

export type WidgetArchetypeDefinition = {
  archetype: DashboardWidgetArchetype;
  footprints: AtomicTileFootprint[];
  defaultFootprint: AtomicTileFootprint;
  /** Registry-driven snap strategy id. */
  snapStrategy: "footprint" | "work-requests";
};

const WIDGET_ARCHETYPE_MAP: Record<string, WidgetArchetypeDefinition> = {
  [WORK_REQUESTS_WIDGET_ID]: {
    archetype: "kpi",
    footprints: KPI_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 2, lh: 1 }),
    snapStrategy: "work-requests",
  },
  important_dates: {
    archetype: "elastic",
    footprints: ELASTIC_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 2, lh: 3 }),
    snapStrategy: "footprint",
  },
  training_compliance: {
    archetype: "elastic",
    footprints: ELASTIC_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 2, lh: 3 }),
    snapStrategy: "footprint",
  },
  workforce: {
    archetype: "elastic",
    footprints: ELASTIC_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 3, lh: 2 }),
    snapStrategy: "footprint",
  },
  low_inventory: {
    archetype: "elastic",
    footprints: ELASTIC_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 3, lh: 2 }),
    snapStrategy: "footprint",
  },
  co2_monitoring: {
    archetype: "kpi",
    footprints: KPI_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 2, lh: 2 }),
    snapStrategy: "footprint",
  },
  facility_schedule: {
    archetype: "elastic",
    footprints: ELASTIC_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 4, lh: 2 }),
    snapStrategy: "footprint",
  },
  routine_assignments: {
    archetype: "elastic",
    footprints: ELASTIC_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 4, lh: 2 }),
    snapStrategy: "footprint",
  },
  pool_readings: {
    archetype: "workspace",
    footprints: WORKSPACE_ATOMIC_FOOTPRINTS,
    defaultFootprint: logicalToAtomic({ lw: 4, lh: 3 }),
    snapStrategy: "footprint",
  },
};

export function getWidgetArchetype(widgetId: string): WidgetArchetypeDefinition {
  if (widgetId.startsWith("cw_")) {
    return {
      archetype: "elastic",
      footprints: CUSTOM_PEEK_ATOMIC_FOOTPRINTS,
      defaultFootprint: logicalToAtomic({ lw: 2, lh: 2 }),
      snapStrategy: "footprint",
    };
  }
  return (
    WIDGET_ARCHETYPE_MAP[widgetId] ?? {
      archetype: "elastic",
      footprints: CUSTOM_PEEK_ATOMIC_FOOTPRINTS,
      defaultFootprint: logicalToAtomic({ lw: 2, lh: 2 }),
      snapStrategy: "footprint",
    }
  );
}

export function widgetArchetypeTier(widgetId: string): DashboardWidgetArchetype {
  return getWidgetArchetype(widgetId).archetype;
}

export function getTileFootprintsForWidget(widgetId: string): AtomicTileFootprint[] {
  return getWidgetArchetype(widgetId).footprints;
}

export function defaultFootprintForWidget(widgetId: string): AtomicTileFootprint {
  return getWidgetArchetype(widgetId).defaultFootprint;
}
