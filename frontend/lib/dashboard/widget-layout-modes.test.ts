import { describe, expect, it } from "vitest";

import {
  elasticListLimits,
  modeFromHeightTier,
  routineAssignmentLimits,
  trainingRadialSize,
  trainingUsesRowLayout,
  workRequestsKpiMetrics,
  workRequestsLayoutForTier,
} from "@/lib/dashboard/widget-layout-modes";

describe("widget-layout-modes", () => {
  it("maps height tiers to widget modes", () => {
    expect(modeFromHeightTier("compact")).toBe("xs");
    expect(modeFromHeightTier("medium")).toBe("sm");
    expect(modeFromHeightTier("expanded", "edge")).toBe("md");
    expect(modeFromHeightTier("expanded", "hero")).toBe("lg");
    expect(modeFromHeightTier("tall", "hero")).toBe("xl");
  });

  it("scales training radial sizes with tier", () => {
    expect(trainingRadialSize("compact")).toBe("sm");
    expect(trainingRadialSize("tall")).toBe("xl");
    expect(trainingUsesRowLayout("medium")).toBe(false);
    expect(trainingUsesRowLayout("expanded")).toBe(true);
  });

  it("selects work request layout modes by tier", () => {
    expect(workRequestsLayoutForTier("compact")).toBe("4x1");
    expect(workRequestsLayoutForTier("expanded")).toBe("2x2");
    expect(workRequestsLayoutForTier("tall")).toBe("1x4");
  });

  it("computes proportional KPI cell sizes within tier bounds", () => {
    const compact = workRequestsKpiMetrics("compact", 280, 120);
    expect(compact.layoutMode).toBe("4x1");
    expect(compact.cellPx).toBeGreaterThanOrEqual(56);
    expect(compact.cellPx).toBeLessThanOrEqual(72);

    const tall = workRequestsKpiMetrics("tall", 280, 480);
    expect(tall.layoutMode).toBe("1x4");
    expect(tall.cellPx).toBeGreaterThanOrEqual(80);
  });

  it("expands elastic list limits as tier grows", () => {
    expect(elasticListLimits("compact").maxItems).toBeLessThan(elasticListLimits("tall").maxItems);
    expect(routineAssignmentLimits("tall").maxAssignments).toBeGreaterThan(
      routineAssignmentLimits("compact").maxAssignments,
    );
  });
});
