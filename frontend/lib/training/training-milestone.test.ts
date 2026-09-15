import { describe, expect, it } from "vitest";

import { isTrainingRouteHiddenInMilestone } from "@/lib/training/training-milestone";

describe("isTrainingRouteHiddenInMilestone", () => {
  it("keeps training compliance reachable", () => {
    expect(isTrainingRouteHiddenInMilestone("/training/compliance")).toBe(false);
    expect(isTrainingRouteHiddenInMilestone("/training/compliance/matrix")).toBe(false);
    expect(isTrainingRouteHiddenInMilestone("/training/compliance/workers")).toBe(false);
  });

  it("still hides dormant overview and learning routes", () => {
    expect(isTrainingRouteHiddenInMilestone("/training/overview")).toBe(true);
    expect(isTrainingRouteHiddenInMilestone("/training/learning")).toBe(true);
    expect(isTrainingRouteHiddenInMilestone("/training/learning/courses")).toBe(true);
  });

  it("allows flashcards and hides interview prep", () => {
    expect(isTrainingRouteHiddenInMilestone("/training/flashcards")).toBe(false);
    expect(isTrainingRouteHiddenInMilestone("/training/interviews")).toBe(true);
  });
});
