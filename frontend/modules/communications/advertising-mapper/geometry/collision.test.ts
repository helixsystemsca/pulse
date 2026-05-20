import { describe, expect, it } from "vitest";
import { inventoryIntersectsConstraint } from "@/modules/communications/advertising-mapper/geometry/collision";
import type { ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";
import type { InventoryBlock } from "@/modules/communications/advertising-mapper/types";

const blocked: ConstraintRegion = {
  id: "c1",
  type: "polygon",
  constraintType: "blocked",
  points: [10, 10, 50, 10, 50, 50, 10, 50],
};

const block: InventoryBlock = {
  id: "b1",
  name: "Test",
  x: 20,
  y: 20,
  width_inches: 20,
  height_inches: 20,
  status: "available",
};

describe("inventoryIntersectsConstraint", () => {
  it("detects overlap with blocked polygon", () => {
    expect(inventoryIntersectsConstraint(block, blocked)).toBe(true);
  });

  it("returns false when inventory is outside polygon", () => {
    expect(
      inventoryIntersectsConstraint({ ...block, x: 200, y: 200 }, blocked),
    ).toBe(false);
  });
});
