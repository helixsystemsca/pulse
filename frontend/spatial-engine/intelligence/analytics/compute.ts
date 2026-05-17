import { extentSize } from "@/spatial-engine/document/extent";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import { serializeSpatialDocument } from "@/spatial-engine/document/serialization";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import { evaluateDocumentCollisions } from "@/spatial-engine/intelligence/collision";
import type {
  SpatialAnalyticsOverlay,
  SpatialAnalyticsSummary,
  SpatialProposalExport,
  TelemetryOverlayPoint,
} from "@/spatial-engine/intelligence/analytics/types";

export function computeSpatialAnalytics(doc: SpatialDocument): SpatialAnalyticsSummary {
  const inventory = getDocumentLayer(doc, "inventory")?.items ?? [];
  const constraints = getDocumentLayer(doc, "constraints")?.features ?? [];
  const graph = getDocumentLayer(doc, "graph");
  const annotations = getDocumentLayer(doc, "annotations")?.features ?? [];
  const sensors = getDocumentLayer(doc, "sensors")?.features ?? [];

  const totalInventoryArea = inventory.reduce(
    (sum, item) => sum + item.geometry.width * item.geometry.height,
    0,
  );
  const { width, height } = extentSize(doc.coordinateSpace.extent);
  const workspaceArea = Math.max(1e-6, width * height);
  const utilizationPct = Math.min(100, (totalInventoryArea / workspaceArea) * 100);

  const collisions = evaluateDocumentCollisions(doc, { treatRestrictedAsWarning: true });
  let collisionErrorCount = 0;
  let collisionWarningCount = 0;
  for (const result of collisions.values()) {
    for (const v of result.violations) {
      if (v.severity === "error") collisionErrorCount += 1;
      else if (v.severity === "warning") collisionWarningCount += 1;
    }
  }

  return {
    inventoryCount: inventory.length,
    constraintCount: constraints.length,
    graphNodeCount: graph?.nodes.length ?? 0,
    graphEdgeCount: graph?.edges.length ?? 0,
    annotationCount: annotations.length,
    sensorCount: sensors.length,
    totalInventoryArea,
    workspaceArea,
    utilizationPct,
    collisionErrorCount,
    collisionWarningCount,
  };
}

export function buildTelemetryOverlays(doc: SpatialDocument): TelemetryOverlayPoint[] {
  const points: TelemetryOverlayPoint[] = [];
  const sensors = getDocumentLayer(doc, "sensors")?.features ?? [];
  for (const s of sensors) {
    const value = typeof s.metadata.value === "number" ? s.metadata.value : 0;
    points.push({
      id: s.id,
      position: { x: s.position.x, y: s.position.y },
      value,
      label: typeof s.metadata.label === "string" ? s.metadata.label : s.sensorType,
      unit: typeof s.metadata.unit === "string" ? s.metadata.unit : undefined,
      severity:
        value > 90 ? "critical" : value > 70 ? "warning" : "normal",
    });
  }
  return points;
}

export function buildSpatialAnalyticsOverlays(doc: SpatialDocument): SpatialAnalyticsOverlay[] {
  const summary = computeSpatialAnalytics(doc);
  const { width, height } = extentSize(doc.coordinateSpace.extent);
  const telemetry = buildTelemetryOverlays(doc);
  const overlays: SpatialAnalyticsOverlay[] = [];

  if (telemetry.length > 0) {
    overlays.push({
      id: "telemetry-sensors",
      kind: "heatmap",
      label: "Sensor telemetry",
      visible: true,
      points: telemetry,
    });
  }

  const violations: TelemetryOverlayPoint[] = [];
  const inventory = getDocumentLayer(doc, "inventory")?.items ?? [];
  const collisions = evaluateDocumentCollisions(doc);
  for (const item of inventory) {
    const result = collisions.get(item.id);
    if (!result || result.valid) continue;
    violations.push({
      id: `violation-${item.id}`,
      position: { x: item.geometry.x, y: item.geometry.y },
      value: result.violations.length,
      label: item.id,
      severity: "critical",
    });
  }

  if (violations.length > 0) {
    overlays.push({
      id: "placement-violations",
      kind: "violation",
      label: "Placement violations",
      visible: true,
      points: violations,
    });
  }

  if (summary.utilizationPct > 0) {
    overlays.push({
      id: "utilization-metric",
      kind: "metric",
      label: `Utilization ${summary.utilizationPct.toFixed(1)}%`,
      visible: false,
      points: [
        {
          id: "util-center",
          position: {
            x: width / 2,
            y: height / 2,
          },
          value: summary.utilizationPct,
          label: "Utilization",
          unit: "%",
        },
      ],
    });
  }

  return overlays;
}

export function createProposalExport(
  doc: SpatialDocument,
  format: SpatialProposalExport["format"] = "summary",
): SpatialProposalExport {
  const summary = computeSpatialAnalytics(doc);
  return {
    documentId: doc.id,
    exportedAt: new Date().toISOString(),
    format,
    title: doc.metadata.title,
    summary,
    documentJson: format === "json" ? serializeSpatialDocument(doc) : undefined,
  };
}
