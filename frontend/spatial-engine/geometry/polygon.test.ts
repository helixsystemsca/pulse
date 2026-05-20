import { describe, expect, it } from "vitest";
import { pointInPolygon, rectCorners, rectsOverlap } from "@/spatial-engine/geometry/polygon";
import { rectIntersectsPolygon } from "@/spatial-engine/geometry/collision";

describe("spatial-engine polygon", () => {
  it("detects point inside triangle", () => {
    const tri = [0, 0, 100, 0, 50, 80];
    expect(pointInPolygon(50, 20, tri)).toBe(true);
    expect(pointInPolygon(5, 70, tri)).toBe(false);
  });

  it("rect overlap and rect-polygon intersection", () => {
    const poly = [0, 0, 50, 0, 50, 50, 0, 50];
    expect(rectsOverlap(10, 10, 20, 20, 25, 25, 20, 20)).toBe(true);
    expect(rectIntersectsPolygon({ x: 10, y: 10, width: 5, height: 5 }, poly)).toBe(true);
    expect(rectIntersectsPolygon({ x: 200, y: 200, width: 5, height: 5 }, poly)).toBe(false);
  });

  it("rectCorners has four points", () => {
    expect(rectCorners(0, 0, 10, 20)).toHaveLength(4);
  });
});
