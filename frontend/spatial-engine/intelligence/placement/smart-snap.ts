import { extentSize } from "@/spatial-engine/document/extent";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import { clampPointToRect, snapToGrid } from "@/spatial-engine/geometry/snap";
import { pairsFromFlatPoints } from "@/spatial-engine/geometry/polygon";
import type { SnapTarget, SmartSnapOptions, SnappedPlacement } from "@/spatial-engine/intelligence/placement/types";

function nearestTarget(
  value: number,
  targets: SnapTarget[],
  threshold: number,
  axis: "x" | "y",
): { value: number; snapped: boolean; target?: SnapTarget } {
  let best: SnapTarget | undefined;
  let bestDist = threshold + 1;
  for (const t of targets) {
    const coord = axis === "x" ? t.x : t.y;
    const d = Math.abs(coord - value);
    if (d <= threshold && d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  if (best) return { value: axis === "x" ? best.x : best.y, snapped: true, target: best };
  return { value, snapped: false };
}

/** Collect snap targets from document geometry (deterministic order). */
export function collectSnapTargets(doc: SpatialDocument): SnapTarget[] {
  const targets: SnapTarget[] = [];
  const { width, height } = extentSize(doc.coordinateSpace.extent);

  targets.push(
    { kind: "corner", x: 0, y: 0 },
    { kind: "corner", x: width, y: 0 },
    { kind: "corner", x: 0, y: height },
    { kind: "corner", x: width, y: height },
  );

  const inventory = getDocumentLayer(doc, "inventory")?.items ?? [];
  for (const item of inventory) {
    const { x, y, width: w, height: h } = item.geometry;
    targets.push(
      { kind: "corner", x, y, sourceId: item.id },
      { kind: "corner", x: x + w, y, sourceId: item.id },
      { kind: "corner", x, y: y + h, sourceId: item.id },
      { kind: "corner", x: x + w, y: y + h, sourceId: item.id },
    );
  }

  const constraints = getDocumentLayer(doc, "constraints")?.features ?? [];
  for (const f of constraints) {
    if (f.geometry.kind !== "polygon") continue;
    for (const v of pairsFromFlatPoints(f.geometry.points)) {
      targets.push({ kind: "constraint_vertex", x: v.x, y: v.y, sourceId: f.id });
    }
  }

  const graph = getDocumentLayer(doc, "graph");
  if (graph) {
    for (const n of graph.nodes) {
      targets.push({ kind: "vertex", x: n.position.x, y: n.position.y, sourceId: n.id });
    }
  }

  return targets;
}

/** Snap top-left of a rect using grid + document targets. */
export function snapRectPlacement(
  x: number,
  y: number,
  rectWidth: number,
  rectHeight: number,
  doc: SpatialDocument,
  options: SmartSnapOptions,
): SnappedPlacement {
  const { width, height } = extentSize(doc.coordinateSpace.extent);
  const clamped = clampPointToRect(x, y, rectWidth, rectHeight, width, height);

  let sx = snapToGrid(clamped.x, options.gridSize, options.gridEnabled);
  let sy = snapToGrid(clamped.y, options.gridSize, options.gridEnabled);
  let snappedX = sx !== clamped.x;
  let snappedY = sy !== clamped.y;
  let target: SnapTarget | undefined;

  if (options.axisSnap !== false) {
    const targets = collectSnapTargets(doc);
    const nx = nearestTarget(sx, targets, options.snapThreshold, "x");
    const ny = nearestTarget(sy, targets, options.snapThreshold, "y");
    if (nx.snapped) {
      sx = nx.value;
      snappedX = true;
      target = nx.target;
    }
    if (ny.snapped) {
      sy = ny.value;
      snappedY = true;
      target = ny.target ?? target;
    }
  }

  return { x: sx, y: sy, snappedX, snappedY, target };
}
