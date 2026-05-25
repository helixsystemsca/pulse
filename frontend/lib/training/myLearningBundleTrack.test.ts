import { describe, expect, it } from "vitest";
import type { LearningBundle } from "@/lib/training/learning-bundles";
import { ONBOARDING_BUNDLE_SEED_ITEMS } from "@/lib/training/learning-bundles";
import {
  buildMyLearningBundleTrack,
  isLearningBundlePart1Complete,
  sortLearningBundlesForTrack,
} from "@/lib/training/myLearningBundleTrack";
import type { TrainingFlowState } from "@/lib/training/trainingFlow";
import type { TrainingProgram } from "@/lib/training/types";

const t = "2026-01-01T00:00:00.000Z";

function bundle(
  id: string,
  category: LearningBundle["category"],
  items: LearningBundle["items"],
): LearningBundle {
  return {
    id,
    title: id,
    description: "",
    category,
    items,
    due_within_days: null,
    renewal_months: null,
    requires_acknowledgement: true,
    requires_upload: false,
    active: true,
    created_at: t,
    updated_at: t,
  };
}

function flow(part1Complete: boolean): TrainingFlowState {
  return {
    step: part1Complete ? "part1_complete" : "read",
    phase: part1Complete ? "part2" : "part1",
    tag: part1Complete ? "PART 1 DONE" : "READ",
    detail: "detail",
    part1Complete,
    fullyCertified: false,
    needsWorkerAction: !part1Complete,
  };
}

describe("myLearningBundleTrack", () => {
  it("orders bundles by category sequence", () => {
    const ordered = sortLearningBundlesForTrack([
      bundle("ops", "operations", []),
      bundle("onb", "onboarding", []),
    ]);
    expect(ordered.map((b) => b.id)).toEqual(["onb", "ops"]);
  });

  it("marks onboarding complete only when all procedure items have Part 1 done", () => {
    const onb = bundle("bundle-new-hire", "onboarding", ONBOARDING_BUNDLE_SEED_ITEMS);
    const programsById = new Map<string, TrainingProgram>();
    const flowByProgramId = new Map<string, TrainingFlowState>([
      ["tp-orientation", flow(true)],
      ["tp-whmis", flow(false)],
    ]);
    expect(isLearningBundlePart1Complete(onb, programsById, flowByProgramId)).toBe(false);
    flowByProgramId.set("tp-whmis", flow(true));
    expect(isLearningBundlePart1Complete(onb, programsById, flowByProgramId)).toBe(true);
  });

  it("exposes completed badge and advances to next bundle", () => {
    const bundles = [
      bundle("bundle-new-hire", "onboarding", ONBOARDING_BUNDLE_SEED_ITEMS),
      bundle("bundle-arena-ops", "operations", [
        {
          id: "a1",
          source: "procedure",
          ref_id: "tp-loto",
          label: "Lockout / Tagout",
          sort_order: 0,
        },
      ]),
    ];
    const programsById = new Map<string, TrainingProgram>([
      [
        "tp-orientation",
        {
          id: "tp-orientation",
          title: "Orientation",
          tier: "mandatory",
        } as TrainingProgram,
      ],
      [
        "tp-whmis",
        { id: "tp-whmis", title: "WHMIS", tier: "mandatory" } as TrainingProgram,
      ],
      ["tp-loto", { id: "tp-loto", title: "LOTO", tier: "high_risk" } as TrainingProgram],
    ]);
    const flowByProgramId = new Map<string, TrainingFlowState>([
      ["tp-orientation", flow(true)],
      ["tp-whmis", flow(true)],
      ["tp-loto", flow(false)],
    ]);

    const track = buildMyLearningBundleTrack(bundles, {
      programsById,
      flowByProgramId,
      alertByProgramId: new Map(),
    });

    expect(track.completedBadges).toEqual([
      { bundleId: "bundle-new-hire", label: "Onboarding", title: "bundle-new-hire" },
    ]);
    expect(track.active?.bundleId).toBe("bundle-arena-ops");
    expect(track.active?.items).toHaveLength(1);
    expect(track.active?.items[0]?.done).toBe(false);
  });
});
