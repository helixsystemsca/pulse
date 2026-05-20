import type { WorldPoint } from "@/spatial-engine/types/spatial";

/** Metadata key on any spatial feature carrying platform entity links. */
export const SPATIAL_ENTITY_LINKS_KEY = "entityLinks";

/** Canonical link targets from spatial geometry → operational records. */
export type SpatialEntityLinkKind =
  | "work_order"
  | "procedure"
  | "contract"
  | "equipment"
  | "asset"
  | "telemetry"
  | "schedule"
  | "inspection"
  | "sponsor"
  | "inventory"
  | "maintenance";

export type SpatialEntityLink = {
  kind: SpatialEntityLinkKind;
  id: string;
  label?: string;
  /** Deep-link or API href for host apps. */
  href?: string;
};

/** Live operational overlay kinds (transient — not persisted in SpatialDocument). */
export type SpatialOperationalOverlayKind =
  | "equipment_status"
  | "sensor_telemetry"
  | "maintenance_alert"
  | "signage_occupancy"
  | "inspection_state"
  | "work_order"
  | "schedule"
  | "heatmap"
  | "utilization"
  | "revenue"
  | "maintenance_hotspot"
  | "constraint_warning"
  | "safety_zone";

export type SpatialOperationalSeverity = "normal" | "info" | "warning" | "critical";

export type SpatialOperationalOverlayPoint = {
  id: string;
  position: WorldPoint;
  label: string;
  value?: number;
  unit?: string;
  severity?: SpatialOperationalSeverity;
  /** Linked platform entity for drill-down. */
  link?: SpatialEntityLink;
  /** Opaque domain payload (WO status, inspection result, …). */
  payload?: Record<string, unknown>;
};

export type SpatialOperationalOverlay = {
  id: string;
  kind: SpatialOperationalOverlayKind;
  label: string;
  visible: boolean;
  points: SpatialOperationalOverlayPoint[];
  /** Optional heatmap intensity 0–1 per point when kind is heatmap/revenue/utilization. */
  intensityField?: "value";
};

/** Slice shapes — host apps map API DTOs into these (keeps engine free of cmms imports). */
export type WorkOrderOperationalSlice = {
  id: string;
  title: string;
  status: string;
  assetId?: string | null;
  zoneId?: string | null;
  equipmentId?: string | null;
  position?: WorldPoint;
  severity?: SpatialOperationalSeverity;
};

export type TelemetryOperationalSlice = {
  id: string;
  label: string;
  position: WorldPoint;
  value: number;
  unit?: string;
  equipmentId?: string | null;
  zoneId?: string | null;
  severity?: SpatialOperationalSeverity;
};

export type InspectionOperationalSlice = {
  id: string;
  templateId?: string;
  label: string;
  position?: WorldPoint;
  zoneId?: string | null;
  equipmentId?: string | null;
  state: "pending" | "passed" | "failed" | "overdue" | "scheduled";
};

export type EquipmentOperationalSlice = {
  id: string;
  name: string;
  position?: WorldPoint;
  zoneId?: string | null;
  assetId?: string | null;
  status: "online" | "offline" | "maintenance" | "unknown";
};

export type ScheduleOperationalSlice = {
  id: string;
  workerId: string;
  label: string;
  position?: WorldPoint;
  startsAt: string;
  endsAt: string;
};

export type SponsorshipOperationalSlice = {
  inventoryItemId: string;
  sponsorName: string;
  contractId?: string;
  revenue?: number;
  occupancyPct?: number;
};

export type MaintenanceOperationalSlice = {
  id: string;
  title: string;
  position?: WorldPoint;
  assetId?: string | null;
  dueDate?: string | null;
  severity?: SpatialOperationalSeverity;
};

/**
 * Operational context bundle — fetched by workspace hosts and passed to overlay builders.
 * Does not mutate the canonical SpatialDocument.
 */
export type SpatialOperationalContext = {
  workOrders?: WorkOrderOperationalSlice[];
  telemetry?: TelemetryOperationalSlice[];
  inspections?: InspectionOperationalSlice[];
  equipment?: EquipmentOperationalSlice[];
  schedules?: ScheduleOperationalSlice[];
  sponsorships?: SponsorshipOperationalSlice[];
  maintenance?: MaintenanceOperationalSlice[];
};

export type SpatialOperationalLayerToggles = {
  equipmentStatus: boolean;
  sensorTelemetry: boolean;
  maintenanceAlerts: boolean;
  signageOccupancy: boolean;
  inspectionStates: boolean;
  analyticsHeatmaps: boolean;
  constraintWarnings: boolean;
};

export const DEFAULT_OPERATIONAL_LAYER_TOGGLES: SpatialOperationalLayerToggles = {
  equipmentStatus: true,
  sensorTelemetry: true,
  maintenanceAlerts: true,
  signageOccupancy: true,
  inspectionStates: true,
  analyticsHeatmaps: true,
  constraintWarnings: true,
};
