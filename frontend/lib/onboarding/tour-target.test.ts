import { afterEach, describe, expect, it, vi } from "vitest";
import { stepCanStart, stepHasTourTarget, tourSel } from "@/lib/onboarding/tour-target";
import type { TourStep } from "@/lib/onboarding/tour-steps/types";

function step(partial: Partial<TourStep> & Pick<TourStep, "target">): TourStep {
  return {
    title: "t",
    description: "d",
    placement: "bottom",
    ...partial,
  };
}

function stubTourDocument(ids: readonly string[]) {
  const has = (sel: string) => {
    const id = /data-tour="([^"]+)"/.exec(sel)?.[1];
    return Boolean(id && ids.includes(id));
  };
  vi.stubGlobal("document", {
    querySelector: (sel: string) => (has(sel) ? { click() {} } : null),
    querySelectorAll: (sel: string) => (has(sel) ? [{}] : []),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("stepCanStart", () => {
  it("starts when the spotlight target is in the document", () => {
    stubTourDocument(["equipment-tour-tabs"]);
    expect(stepCanStart(step({ target: tourSel("equipment-tour-tabs") }))).toBe(true);
  });

  it("starts when only the prepare-click control exists", () => {
    stubTourDocument(["equipment-tour-list-tab"]);
    expect(
      stepCanStart(
        step({
          target: tourSel("equipment-tour-list"),
          prepareClick: tourSel("equipment-tour-list-tab"),
        }),
      ),
    ).toBe(true);
    expect(stepHasTourTarget(step({ target: tourSel("equipment-tour-list") }))).toBe(false);
  });

  it("does not start when both the target and prepare-click control are missing", () => {
    stubTourDocument(["equipment-tour-tabs"]);
    expect(
      stepCanStart(
        step({
          target: tourSel("equipment-tour-facility-filter"),
          prepareClick: tourSel("equipment-tour-list-tab"),
        }),
      ),
    ).toBe(false);
    expect(stepCanStart(step({ target: tourSel("inventory-tour-facility") }))).toBe(false);
  });
});
