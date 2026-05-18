import { getDocumentLayer } from "@/spatial-engine/document/query";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import { evaluateDocumentCollisions, validateInventoryPlacement } from "@/spatial-engine/intelligence/collision";
import type { ConstraintFeatureDocument } from "@/spatial-engine/document/layers";
import type {
  SpatialOperationalOverlay,
  SpatialOperationalOverlayPoint,
  SpatialOperationalSeverity,
} from "@/spatial-engine/operations/types";

export type ConstraintOperationalWarning = {
  id: string;
  constraintId: string;
  constraintType: string;
  severity: SpatialOperationalSeverity;
  message: string;
  position: { x: number; y: number };
  featureId?: string;
};

function constraintCentroid(f: ConstraintFeatureDocument): { x: number; y: number } {
  const pts = f.geometry.points;
  if (pts.length < 2) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i + 1 < pts.length; i += 2) {
    sx += pts[i]!;
    sy += pts[i + 1]!;
    n += 1;
  }
  return n ? { x: sx / n, y: sy / n } : { x: pts[0]!, y: pts[1]! };
}

function severityForConstraintType(type: string): SpatialOperationalSeverity {
  const t = type.toLowerCase();
  if (t.includes("blocked") || t.includes("restricted")) return "critical";
  if (t.includes("premium") || t.includes("electrical")) return "warning";
  return "info";
}

/** Operational warnings from constraint regions (placement + safety overlays). */
export function buildConstraintOperationalWarnings(doc: SpatialDocument): ConstraintOperationalWarning[] {
  const warnings: ConstraintOperationalWarning[] = [];
  const constraints = getDocumentLayer(doc, "constraints")?.features ?? [];

  for (const c of constraints) {
    const constraintType = String(c.metadata.constraintType ?? "constraint");
    const pos = constraintCentroid(c);
    warnings.push({
      id: `constraint-region-${c.id}`,
      constraintId: c.id,
      constraintType,
      severity: severityForConstraintType(constraintType),
      message: `Restricted: ${constraintType}`,
      position: pos,
    });
  }

  const inventory = getDocumentLayer(doc, "inventory")?.items ?? [];
  const collisions = evaluateDocumentCollisions(doc, { treatRestrictedAsWarning: true });
  for (const item of inventory) {
    const result = collisions.get(item.id) ?? validateInventoryPlacement(doc, {
      id: item.id,
      x: item.geometry.x,
      y: item.geometry.y,
      width: item.geometry.width,
      height: item.geometry.height,
    });
    if (result.valid) continue;
    for (const v of result.violations) {
      warnings.push({
        id: `placement-${item.id}-${v.kind}`,
        constraintId: v.constraintId ?? item.id,
        constraintType: v.kind,
        severity: v.severity === "error" ? "critical" : "warning",
        message: v.message,
        position: {
          x: item.geometry.x + item.geometry.width / 2,
          y: item.geometry.y + item.geometry.height / 2,
        },
        featureId: item.id,
      });
    }
  }

  return warnings;
}

export function constraintWarningsToOverlay(
  warnings: ConstraintOperationalWarning[],
): SpatialOperationalOverlay | null {
  if (!warnings.length) return null;
  const points: SpatialOperationalOverlayPoint[] = warnings.map((w) => ({
    id: w.id,
    position: w.position,
    label: w.message,
    severity: w.severity,
    payload: {
      constraintId: w.constraintId,
      constraintType: w.constraintType,
      featureId: w.featureId,
    },
  }));
  return {
    id: "constraint-warnings",
    kind: "constraint_warning",
    label: "Constraint warnings",
    visible: true,
    points,
  };
}

export function buildSafetyZoneOverlays(doc: SpatialDocument): SpatialOperationalOverlay[] {
  const constraints = getDocumentLayer(doc, "constraints")?.features ?? [];
  const blocked = constraints.filter((c) =>
    String(c.metadata.constraintType ?? "").toLowerCase().includes("blocked"),
  );
  if (!blocked.length) return [];
  return [
    {
      id: "safety-zones",
      kind: "safety_zone",
      label: "Safety / blocked zones",
      visible: true,
      points: blocked.map((c) => ({
        id: `safety-${c.id}`,
        position: constraintCentroid(c),
        label: String(c.metadata.constraintType ?? "blocked"),
        severity: "critical",
        payload: { constraintId: c.id, points: c.geometry.points },
      })),
    },
  ];
}
