import type { WorldPoint } from "@/spatial-engine/types/spatial";

export type SpatialAnalyticsSummary = {
  inventoryCount: number;
  constraintCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  annotationCount: number;
  sensorCount: number;
  totalInventoryArea: number;
  workspaceArea: number;
  utilizationPct: number;
  collisionErrorCount: number;
  collisionWarningCount: number;
};

export type TelemetryOverlayPoint = {
  id: string;
  position: WorldPoint;
  value: number;
  label: string;
  unit?: string;
  severity?: "normal" | "warning" | "critical";
};

export type SpatialAnalyticsOverlay = {
  id: string;
  kind: "heatmap" | "metric" | "route" | "violation";
  label: string;
  visible: boolean;
  points: TelemetryOverlayPoint[];
};

export type ProposalExportFormat = "json" | "summary";

export type SpatialProposalExport = {
  documentId: string;
  exportedAt: string;
  format: ProposalExportFormat;
  title?: string;
  summary: SpatialAnalyticsSummary;
  /** Full canonical JSON when format is `json`. */
  documentJson?: string;
};
