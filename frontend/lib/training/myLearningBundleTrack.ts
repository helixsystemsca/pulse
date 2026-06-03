import type { EmployeeComplianceAlert } from "@/lib/training/complianceAlerts";
import {
  LEARNING_BUNDLE_CATEGORY_LABELS,
  type LearningBundle,
  type LearningBundleCategory,
  type LearningBundleItem,
} from "@/lib/training/learning-bundles";
import type { MyLearningChecklistItem } from "@/lib/training/myLearningDashboard";
import type { TrainingFlowState } from "@/lib/training/trainingFlow";
import type { TrainingProgram } from "@/lib/training/types";

/** Category order for sequential bundle unlock on My Learning. */
export const LEARNING_BUNDLE_SEQUENCE: LearningBundleCategory[] = [
  "onboarding",
  "operations",
  "certification_track",
  "supervisor",
  "seasonal",
  "other",
];

export type MyLearningBundleBadge = {
  bundleId: string;
  /** Short label for collapsed badge (e.g. "Onboarding"). */
  label: string;
  title: string;
};

export type MyLearningBundleChecklist = {
  bundleId: string;
  title: string;
  category: LearningBundleCategory;
  categoryLabel: string;
  items: MyLearningChecklistItem[];
  /** All bundle items have Part 1 complete (read → ack → quiz). */
  complete: boolean;
  incompleteCount: number;
};

export type MyLearningBundleTrack = {
  completedBadges: MyLearningBundleBadge[];
  /** First incomplete bundle in sequence; null when every bundle is done. */
  active: MyLearningBundleChecklist | null;
};

export function sortLearningBundlesForTrack(bundles: LearningBundle[]): LearningBundle[] {
  return [...bundles]
    .filter((b) => b.active)
    .sort((a, b) => {
      const ca = LEARNING_BUNDLE_SEQUENCE.indexOf(a.category);
      const cb = LEARNING_BUNDLE_SEQUENCE.indexOf(b.category);
      if (ca !== cb) return ca - cb;
      return a.title.localeCompare(b.title);
    });
}

function bundleBadgeLabel(bundle: LearningBundle): string {
  return LEARNING_BUNDLE_CATEGORY_LABELS[bundle.category] ?? bundle.title;
}

function isBundleItemPart1Done(
  item: LearningBundleItem,
  programsById: Map<string, TrainingProgram>,
  flowByProgramId: Map<string, TrainingFlowState>,
): boolean {
  if (item.source !== "procedure") return false;
  const flow = flowByProgramId.get(item.ref_id);
  if (flow) return flow.part1Complete;
  return false;
}

export function isLearningBundlePart1Complete(
  bundle: LearningBundle,
  programsById: Map<string, TrainingProgram>,
  flowByProgramId: Map<string, TrainingFlowState>,
): boolean {
  const procedureItems = bundle.items.filter((i) => i.source === "procedure");
  if (procedureItems.length === 0) return false;
  return procedureItems.every((item) =>
    isBundleItemPart1Done(item, programsById, flowByProgramId),
  );
}

function buildChecklistItem(
  item: LearningBundleItem,
  programsById: Map<string, TrainingProgram>,
  flowByProgramId: Map<string, TrainingFlowState>,
  alertByProgramId: Map<string, EmployeeComplianceAlert>,
): MyLearningChecklistItem {
  if (item.source === "external") {
    return {
      programId: item.id,
      title: item.label,
      meta: "External training — complete outside Helix",
      flowTag: "EXTERNAL",
      tier: "general",
      done: false,
      needsAction: true,
      external: true,
    };
  }

  const program = programsById.get(item.ref_id);
  const flow = flowByProgramId.get(item.ref_id);
  const alert = alertByProgramId.get(item.ref_id);

  if (!program || !flow) {
    return {
      programId: item.ref_id,
      title: item.label,
      meta: "Open the procedure to begin Part 1 (read → acknowledge → quiz)",
      flowTag: "NOT STARTED",
      tier: "general",
      done: false,
      needsAction: true,
    };
  }

  return {
    programId: program.id,
    title: program.title,
    meta: alert?.label ?? flow.detail,
    flowTag: flow.tag,
    tier: program.tier,
    done: flow.part1Complete,
    needsAction: flow.needsWorkerAction,
  };
}

function buildBundleChecklist(
  bundle: LearningBundle,
  programsById: Map<string, TrainingProgram>,
  flowByProgramId: Map<string, TrainingFlowState>,
  alertByProgramId: Map<string, EmployeeComplianceAlert>,
): MyLearningBundleChecklist {
  const sortedItems = [...bundle.items].sort((a, b) => a.sort_order - b.sort_order);
  const items = sortedItems.map((item) =>
    buildChecklistItem(item, programsById, flowByProgramId, alertByProgramId),
  );

  items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  const incompleteCount = items.filter((i) => !i.done).length;
  const complete = isLearningBundlePart1Complete(bundle, programsById, flowByProgramId);

  return {
    bundleId: bundle.id,
    title: bundle.title,
    category: bundle.category,
    categoryLabel: bundleBadgeLabel(bundle),
    items,
    complete,
    incompleteCount,
  };
}

export function buildMyLearningBundleTrack(
  bundles: LearningBundle[],
  context: {
    programsById: Map<string, TrainingProgram>;
    flowByProgramId: Map<string, TrainingFlowState>;
    alertByProgramId: Map<string, EmployeeComplianceAlert>;
  },
): MyLearningBundleTrack {
  const ordered = sortLearningBundlesForTrack(bundles);
  const completedBadges: MyLearningBundleBadge[] = [];
  let active: MyLearningBundleChecklist | null = null;

  for (const bundle of ordered) {
    const checklist = buildBundleChecklist(
      bundle,
      context.programsById,
      context.flowByProgramId,
      context.alertByProgramId,
    );

    if (checklist.complete) {
      completedBadges.push({
        bundleId: bundle.id,
        label: checklist.categoryLabel,
        title: bundle.title,
      });
      continue;
    }

    if (!active) {
      active = checklist;
    }
  }

  return { completedBadges, active };
}
