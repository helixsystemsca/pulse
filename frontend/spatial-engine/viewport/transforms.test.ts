import { describe, expect, it } from "vitest";
import { pixelSpace } from "@/spatial-engine/coordinates/pixel-space";
import { createInchSpace } from "@/spatial-engine/coordinates/inch-space";
import { screenToWorld, worldToScreen, zoomViewportAtScreenPoint } from "@/spatial-engine/viewport/transforms";

describe("spatial-engine viewport transforms", () => {
  it("pixel space round-trips screen/world", () => {
    const vp = { scale: 2, panX: 100, panY: 50 };
    const w = screenToWorld(200, 150, vp, pixelSpace);
    const s = worldToScreen(w.x, w.y, vp, pixelSpace);
    expect(s.x).toBeCloseTo(200, 5);
    expect(s.y).toBeCloseTo(150, 5);
  });

  it("inch space converts with base px per inch", () => {
    const inch = createInchSpace(6);
    const vp = { scale: 1, panX: 28, panY: 28 };
    const w = screenToWorld(68, 68, vp, inch, { x: 28, y: 28 });
    expect(w.x).toBeCloseTo(2, 5);
    expect(w.y).toBeCloseTo(2, 5);
  });

  it("zoom keeps focal world point stable", () => {
    const vp = { scale: 1, panX: 0, panY: 0 };
    const before = screenToWorld(100, 100, vp, pixelSpace);
    const next = zoomViewportAtScreenPoint(vp, 100, 100, 1.5, pixelSpace);
    const after = screenToWorld(100, 100, next, pixelSpace);
    expect(after.x).toBeCloseTo(before.x, 5);
    expect(after.y).toBeCloseTo(before.y, 5);
  });
});
