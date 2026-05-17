import { polygonBBox } from "@/spatial-engine/geometry/bbox";
import { pointInPolygon, rectCorners, rectsOverlap } from "@/spatial-engine/geometry/polygon";
import type { FlatPolygonPoints, WorldRect } from "@/spatial-engine/types/spatial";

/** True when any part of `rect` overlaps `polygon`. */
export function rectIntersectsPolygon(rect: WorldRect, polygon: FlatPolygonPoints): boolean {
  if (polygon.length < 6) return false;

  const corners = rectCorners(rect.x, rect.y, rect.width, rect.height);
  if (corners.some((c) => pointInPolygon(c.x, c.y, polygon))) return true;

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  if (pointInPolygon(cx, cy, polygon)) return true;

  for (let i = 0; i < polygon.length; i += 2) {
    const vx = polygon[i]!;
    const vy = polygon[i + 1]!;
    if (vx >= rect.x && vx <= rect.x + rect.width && vy >= rect.y && vy <= rect.y + rect.height) {
      return true;
    }
  }

  const polyBox = polygonBBox(polygon);
  return rectsOverlap(rect.x, rect.y, rect.width, rect.height, polyBox.x, polyBox.y, polyBox.width, polyBox.height);
}
