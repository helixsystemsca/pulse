import { extentSize } from "@/spatial-engine/document/extent";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import { buildSpatialAnalyticsOverlays } from "@/spatial-engine/intelligence/analytics";
import {
  buildConstraintOperationalWarnings,
  buildSafetyZoneOverlays,
  constraintWarningsToOverlay,
} from "@/spatial-engine/operations/constraint-operations";
import type { SpatialAnalyticsOverlay } from "@/spatial-engine/intelligence/analytics/types";
import { readEntityLinks, resolveLinkPosition } from "@/spatial-engine/operations/entity-links";
import type {
  SpatialEntityLink,
  SpatialEntityLinkKind,
  SpatialOperationalContext,
  SpatialOperationalLayerToggles,
  SpatialOperationalOverlay,
  SpatialOperationalOverlayPoint,
  SpatialOperationalSeverity,
} from "@/spatial-engine/operations/types";

function entityLink(kind: SpatialEntityLinkKind, id: string, label?: string): SpatialEntityLink {
  return { kind, id, label };
}

function woSeverity(status: string): SpatialOperationalSeverity {
  const s = status.toLowerCase();
  if (s.includes("overdue") || s.includes("critical")) return "critical";
  if (s.includes("progress") || s.includes("open")) return "warning";
  return "normal";
}

function inspectionSeverity(state: string): SpatialOperationalSeverity {
  if (state === "failed" || state === "overdue") return "critical";
  if (state === "pending" || state === "scheduled") return "warning";
  return "normal";
}

function equipmentSeverity(status: string): SpatialOperationalSeverity {
  if (status === "maintenance") return "warning";
  if (status === "offline") return "critical";
  return "normal";
}

function analyticsToOperational(overlays: SpatialAnalyticsOverlay[]): SpatialOperationalOverlay[] {
  return overlays.map((o) => ({
    id: o.id,
    kind:
      o.kind === "heatmap"
        ? ("heatmap" as const)
        : o.kind === "metric"
          ? ("utilization" as const)
          : o.kind === "violation"
            ? ("constraint_warning" as const)
            : ("heatmap" as const),
    label: o.label,
    visible: o.visible,
    points: o.points.map((p) => ({
      id: p.id,
      position: p.position,
      label: p.label,
      value: p.value,
      unit: p.unit,
      severity: p.severity,
    })),
    intensityField: "value",
  }));
}

export function buildOperationalOverlays(
  doc: SpatialDocument,
  context: SpatialOperationalContext = {},
  toggles: SpatialOperationalLayerToggles = {
    equipmentStatus: true,
    sensorTelemetry: true,
    maintenanceAlerts: true,
    signageOccupancy: true,
    inspectionStates: true,
    analyticsHeatmaps: true,
    constraintWarnings: true,
  },
): SpatialOperationalOverlay[] {
  const overlays: SpatialOperationalOverlay[] = [];

  if (toggles.equipmentStatus && context.equipment?.length) {
    const points: SpatialOperationalOverlayPoint[] = context.equipment
      .filter((e) => e.position)
      .map((e) => ({
        id: `equip-${e.id}`,
        position: e.position!,
        label: e.name,
        severity: equipmentSeverity(e.status),
        link: entityLink("equipment", e.id, e.name),
        payload: { status: e.status, zoneId: e.zoneId, assetId: e.assetId },
      }));
    if (points.length) {
      overlays.push({
        id: "equipment-status",
        kind: "equipment_status",
        label: "Equipment status",
        visible: true,
        points,
      });
    }
  }

  if (toggles.sensorTelemetry) {
    const fromContext: SpatialOperationalOverlayPoint[] =
      context.telemetry?.map((t) => ({
        id: `tel-${t.id}`,
        position: t.position,
        label: t.label,
        value: t.value,
        unit: t.unit,
        severity: t.severity ?? (t.value > 90 ? "critical" : t.value > 70 ? "warning" : "normal"),
        link: t.equipmentId ? { kind: "telemetry", id: t.id, label: t.label } : undefined,
        payload: { equipmentId: t.equipmentId, zoneId: t.zoneId },
      })) ?? [];

    const sensors = getDocumentLayer(doc, "sensors")?.features ?? [];
    const fromDoc: SpatialOperationalOverlayPoint[] = sensors.map((s) => {
      const value = typeof s.metadata.value === "number" ? s.metadata.value : 0;
      return {
        id: `sensor-${s.id}`,
        position: { x: s.position.x, y: s.position.y },
        label: typeof s.metadata.label === "string" ? s.metadata.label : s.sensorType,
        value,
        unit: typeof s.metadata.unit === "string" ? s.metadata.unit : undefined,
        severity: value > 90 ? "critical" : value > 70 ? "warning" : "normal",
        link: entityLink("telemetry", s.id),
      };
    });

    const points = [...fromContext, ...fromDoc];
    if (points.length) {
      overlays.push({
        id: "sensor-telemetry",
        kind: "sensor_telemetry",
        label: "Sensor telemetry",
        visible: true,
        points,
        intensityField: "value",
      });
    }
  }

  if (toggles.maintenanceAlerts) {
    const maint = context.maintenance ?? [];
    const wo = (context.workOrders ?? []).filter((w) => {
      const s = w.status.toLowerCase();
      return s.includes("open") || s.includes("progress") || s.includes("overdue");
    });
    const points: SpatialOperationalOverlayPoint[] = [
      ...maint
        .filter((m) => m.position)
        .map((m) => ({
          id: `maint-${m.id}`,
          position: m.position!,
          label: m.title,
          severity: m.severity ?? "warning",
          link: entityLink("maintenance", m.id, m.title),
          payload: { dueDate: m.dueDate, assetId: m.assetId },
        })),
      ...wo
        .filter((w) => w.position)
        .map((w) => ({
          id: `wo-${w.id}`,
          position: w.position!,
          label: w.title,
          severity: w.severity ?? woSeverity(w.status),
          link: entityLink("work_order", w.id, w.title),
          payload: { status: w.status },
        })),
    ];
    if (points.length) {
      overlays.push({
        id: "maintenance-alerts",
        kind: "maintenance_alert",
        label: "Maintenance & work orders",
        visible: true,
        points,
      });
    }
  }

  if (toggles.inspectionStates && context.inspections?.length) {
    const points: SpatialOperationalOverlayPoint[] = [];
    for (const insp of context.inspections) {
      let position = insp.position;
      if (!position && insp.zoneId) {
        const zoneLinks = doc.layers
          .flatMap((l) => (l.type === "zones" ? l.features : []))
          .find((f) => f.id === insp.zoneId || readEntityLinks(f.metadata).some((lk) => lk.id === insp.zoneId));
        if (zoneLinks && "geometry" in zoneLinks && zoneLinks.geometry.points.length >= 2) {
          position = { x: zoneLinks.geometry.points[0]!, y: zoneLinks.geometry.points[1]! };
        }
      }
      if (!position) continue;
      points.push({
        id: `insp-${insp.id}`,
        position,
        label: insp.label,
        severity: inspectionSeverity(insp.state),
        link: entityLink("inspection", insp.id, insp.label),
        payload: { state: insp.state, templateId: insp.templateId },
      });
    }
    if (points.length) {
      overlays.push({
        id: "inspection-states",
        kind: "inspection_state",
        label: "Inspections",
        visible: true,
        points,
      });
    }
  }

  if (toggles.signageOccupancy && context.sponsorships?.length) {
    const inventory = getDocumentLayer(doc, "inventory")?.items ?? [];
    const points: SpatialOperationalOverlayPoint[] = [];
    for (const s of context.sponsorships) {
      const item = inventory.find((i) => i.id === s.inventoryItemId);
      if (!item) continue;
      const occ = s.occupancyPct ?? 100;
      points.push({
        id: `signage-${s.inventoryItemId}`,
        position: {
          x: item.geometry.x + item.geometry.width / 2,
          y: item.geometry.y + item.geometry.height / 2,
        },
        label: s.sponsorName,
        value: occ,
        unit: "%",
        severity: occ >= 90 ? "normal" : occ >= 50 ? "warning" : "critical",
        link: s.contractId
          ? entityLink("sponsor", s.contractId, s.sponsorName)
          : entityLink("inventory", s.inventoryItemId, s.sponsorName),
        payload: { revenue: s.revenue, occupancyPct: s.occupancyPct },
      });
    }
    if (points.length) {
      overlays.push({
        id: "signage-occupancy",
        kind: "signage_occupancy",
        label: "Signage occupancy",
        visible: true,
        points,
        intensityField: "value",
      });
    }
  }

  if (context.schedules?.length) {
    const points: SpatialOperationalOverlayPoint[] = context.schedules
      .filter((s) => s.position)
      .map((s) => ({
        id: `sched-${s.id}`,
        position: s.position!,
        label: s.label,
        link: entityLink("schedule", s.id, s.label),
        payload: { workerId: s.workerId, startsAt: s.startsAt, endsAt: s.endsAt },
      }));
    if (points.length) {
      overlays.push({
        id: "schedules",
        kind: "schedule",
        label: "Schedules",
        visible: false,
        points,
      });
    }
  }

  if (toggles.analyticsHeatmaps) {
    const analytics = buildSpatialAnalyticsOverlays(doc);
    overlays.push(...analyticsToOperational(analytics));

    const { width, height } = extentSize(doc.coordinateSpace.extent);
    const inv = getDocumentLayer(doc, "inventory")?.items ?? [];
    if (inv.length > 0 && context.sponsorships?.some((s) => s.revenue != null)) {
      const revenuePoints: SpatialOperationalOverlayPoint[] = [];
      for (const item of inv) {
        const sponsor = context.sponsorships!.find((s) => s.inventoryItemId === item.id);
        if (sponsor?.revenue == null) continue;
        revenuePoints.push({
          id: `rev-${item.id}`,
          position: {
            x: item.geometry.x + item.geometry.width / 2,
            y: item.geometry.y + item.geometry.height / 2,
          },
          label: sponsor.sponsorName,
          value: sponsor.revenue,
          unit: "USD",
          severity: "normal",
          link: sponsor.contractId
            ? entityLink("contract", sponsor.contractId)
            : entityLink("inventory", item.id),
        });
      }
      if (revenuePoints.length) {
        overlays.push({
          id: "revenue-overlay",
          kind: "revenue",
          label: "Revenue",
          visible: false,
          points: revenuePoints,
          intensityField: "value",
        });
      }
    }

    const graphNodes = getDocumentLayer(doc, "graph")?.nodes ?? [];
    const woByAsset = new Map(
      (context.workOrders ?? [])
        .filter((w) => w.assetId && w.position)
        .map((w) => [w.assetId!, w]),
    );
    const hotspots: SpatialOperationalOverlayPoint[] = [];
    for (const n of graphNodes) {
      const wo = woByAsset.get(n.id);
      if (!wo?.position) continue;
      hotspots.push({
        id: `hotspot-${n.id}`,
        position: wo.position,
        label: wo.title,
        severity: woSeverity(wo.status),
        link: entityLink("work_order", wo.id),
      });
    }
    if (hotspots.length) {
      overlays.push({
        id: "maintenance-hotspots",
        kind: "maintenance_hotspot",
        label: "Maintenance hotspots",
        visible: false,
        points: hotspots,
      });
    }

    void width;
    void height;
  }

  if (toggles.constraintWarnings) {
    const warningOverlay = constraintWarningsToOverlay(buildConstraintOperationalWarnings(doc));
    if (warningOverlay) overlays.push(warningOverlay);
    overlays.push(...buildSafetyZoneOverlays(doc));
  }

  // Link-derived pins for entities without explicit positions
  for (const layer of doc.layers) {
    if (layer.type !== "graph") continue;
    for (const node of layer.nodes) {
      for (const link of readEntityLinks(node.metadata)) {
        if (link.kind !== "work_order" && link.kind !== "equipment") continue;
        const already = overlays.some((o) =>
          o.points.some((p) => p.link?.kind === link.kind && p.link?.id === link.id),
        );
        if (already) continue;
        const pos = resolveLinkPosition(doc, node.id, "graph");
        if (!pos) continue;
        overlays.push({
          id: `link-${link.kind}-${link.id}`,
          kind: link.kind === "work_order" ? "work_order" : "equipment_status",
          label: link.label ?? link.id,
          visible: true,
          points: [
            {
              id: `${link.kind}-${link.id}`,
              position: pos,
              label: link.label ?? link.id,
              link,
            },
          ],
        });
      }
    }
  }

  return overlays;
}

export function mergeOperationalOverlayVisibility(
  overlays: SpatialOperationalOverlay[],
  visibility: Record<string, boolean>,
): SpatialOperationalOverlay[] {
  return overlays.map((o) => ({
    ...o,
    visible: visibility[o.id] ?? o.visible,
  }));
}
