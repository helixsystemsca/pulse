import type { EmployeeComplianceAlert } from "@/lib/training/complianceAlerts";
import type { LearningBundle } from "@/lib/training/learning-bundles";
import { buildMyLearningBundleTrack, type MyLearningBundleTrack } from "@/lib/training/myLearningBundleTrack";
import { myProcedureRowsForWorker } from "@/lib/training/selectors";
import { deriveTrainingFlowState, type TrainingFlowState, type TrainingFlowStepId } from "@/lib/training/trainingFlow";
import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingProgram,
  TrainingTier,
} from "@/lib/training/types";
function latestAcknowledgementForWorker(
  employeeId: string,
  programId: string,
  acks: TrainingAcknowledgement[],
): TrainingAcknowledgement | undefined {
  return acks
    .filter((a) => a.employee_id === employeeId && a.training_program_id === programId)
    .sort((a, b) => b.revision_number - a.revision_number)[0];
}

export type MyLearningCategoryId = "arena_ops" | "pool_aquatics" | "maintenance";

export type MyLearningItemStatus = "certified" | "part1_done" | "in_progress" | "action_needed";

export type MyLearningTrainingItem = {
  programId: string;
  name: string;
  status: MyLearningItemStatus;
  flowStep: TrainingFlowStepId;
  progressLabel: string;
  flowDetail: string;
  tier: TrainingTier;
  assignmentStatus: TrainingAssignmentStatus;
  quizAttempts: number;
};

export type MyLearningCategory = {
  id: MyLearningCategoryId;
  title: string;
  certified: number;
  part1Complete: number;
  total: number;
  percent: number;
  ringColor: string;
  gradient: string;
  items: MyLearningTrainingItem[];
};

export type MyLearningChecklistItem = {
  programId: string;
  title: string;
  meta: string;
  flowTag: string;
  tier: TrainingTier;
  /** Part 1 complete for this procedure (read → ack → quiz). */
  done: boolean;
  needsAction: boolean;
  external?: boolean;
};

export type MyLearningStats = {
  part1Percent: number;
  part1Description: string;
  part1ActionCount: number;
  part1ActionDescription: string;
  fieldTrainingCount: number;
  fieldTrainingDescription: string;
  certifiedCount: number;
  certifiedDescription: string;
  avgQuizAttempts: number | null;
};

export type MyLearningActivityItem = {
  id: string;
  title: string;
  kind: "read" | "acknowledged" | "quiz" | "certified";
  detail: string;
  dateLabel: string;
  at: string;
};

export type MyLearningDashboardModel = {
  stats: MyLearningStats;
  categories: MyLearningCategory[];
  bundleTrack: MyLearningBundleTrack;
  recentActivity: MyLearningActivityItem[];
};

const CATEGORY_META: Record<
  MyLearningCategoryId,
  { title: string; ringColor: string; gradient: string }
> = {
  arena_ops: {
    title: "Arena routines",
    ringColor: "#10b981",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  },
  pool_aquatics: {
    title: "Pool routines",
    ringColor: "#3b82f6",
    gradient: "linear-gradient(135deg, #56c9d9 0%, #4db8c4 100%)",
  },
  maintenance: {
    title: "Facility & maintenance",
    ringColor: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
  },
};

const CATEGORY_ORDER: MyLearningCategoryId[] = ["arena_ops", "pool_aquatics", "maintenance"];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function classifyMyLearningCategory(program: TrainingProgram): MyLearningCategoryId {
  const title = norm(program.title);
  const dept = norm(program.department_category);
  const tags = program.tracking_tags ?? [];

  if (
    dept === "aquatics" ||
    /\b(pool|aquatic|ice|changeroom|swim|weightroom|weight room|pool deck|backwash)\b/.test(title)
  ) {
    return "pool_aquatics";
  }
  if (/\b(arena|rink)\b/.test(title)) {
    return "arena_ops";
  }
  if (
    dept === "maintenance" ||
    program.tier === "high_risk" ||
    tags.includes("emergency") ||
    /\b(mower|scrubber|blade|glade|field house|inflatable|tile|shade|movie|snow|maintenance|facility|patron|extinguisher)\b/.test(
      title,
    )
  ) {
    return "maintenance";
  }
  if (program.tier === "mandatory" || tags.includes("routine")) {
    if (/\b(pool|aquatic|ice)\b/.test(title)) return "pool_aquatics";
    if (/\b(arena|rink)\b/.test(title)) return "arena_ops";
    return "maintenance";
  }
  if (program.tier === "general") return "maintenance";
  return "maintenance";
}

function itemStatusFromFlow(flow: ReturnType<typeof deriveTrainingFlowState>): MyLearningItemStatus {
  if (flow.fullyCertified) return "certified";
  if (flow.part1Complete) return "part1_done";
  if (flow.needsWorkerAction) return "action_needed";
  return "in_progress";
}

function buildActivity(
  programs: TrainingProgram[],
  assignments: TrainingAssignment[],
  acknowledgements: TrainingAcknowledgement[],
): MyLearningActivityItem[] {
  const byProgram = new Map(programs.map((p) => [p.id, p]));
  const items: MyLearningActivityItem[] = [];

  for (const a of assignments) {
    const p = byProgram.get(a.training_program_id);
    if (!p) continue;
    const title = p.title;

    if (a.quiz_passed_at) {
      const attempts = a.quiz_attempt_count ?? 0;
      items.push({
        id: `quiz-${a.id}`,
        title,
        kind: "quiz",
        detail: `Part 1 complete · ${attempts} quiz attempt${attempts === 1 ? "" : "s"}`,
        dateLabel: a.quiz_passed_at.slice(0, 10),
        at: a.quiz_passed_at,
      });
    }
    if (a.supervisor_signoff && a.completed_date) {
      items.push({
        id: `cert-${a.id}`,
        title,
        kind: "certified",
        detail: "Part 2 — supervisor signed off",
        dateLabel: a.completed_date.slice(0, 10),
        at: a.completed_date,
      });
    }
    if (a.verification_first_viewed_at) {
      items.push({
        id: `read-${a.id}`,
        title,
        kind: "read",
        detail: "Procedure read",
        dateLabel: a.verification_first_viewed_at.slice(0, 10),
        at: a.verification_first_viewed_at,
      });
    }
  }

  for (const k of acknowledgements) {
    const p = byProgram.get(k.training_program_id);
    items.push({
      id: `ack-${k.id}`,
      title: p?.title ?? k.training_program_id,
      kind: "acknowledged",
      detail: `Revision ${k.revision_number} acknowledged`,
      dateLabel: k.acknowledged_at.slice(0, 10),
      at: k.acknowledged_at,
    });
  }

  return items
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 14);
}

export function buildMyLearningDashboard(input: {
  employeeId: string;
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
  acknowledgements: TrainingAcknowledgement[];
  alerts: EmployeeComplianceAlert[];
  bundles: LearningBundle[];
  trustAssignmentStatus?: boolean;
}): MyLearningDashboardModel {
  const { employeeId, programs, assignments, acknowledgements, alerts, bundles, trustAssignmentStatus } =
    input;

  const rows = myProcedureRowsForWorker(
    employeeId,
    programs,
    assignments,
    acknowledgements,
    { trustAssignmentStatus },
  );

  let part1CompleteCount = 0;
  let certifiedCount = 0;
  let part1ActionCount = 0;
  let fieldTrainingCount = 0;
  let quizAttemptSum = 0;
  let quizAttemptRows = 0;

  const itemsByCategory = new Map<MyLearningCategoryId, MyLearningTrainingItem[]>();
  for (const id of CATEGORY_ORDER) itemsByCategory.set(id, []);

  const flowByProgramId = new Map<string, TrainingFlowState>();
  const alertByProgram = new Map(alerts.map((a) => [a.programId, a]));
  const programsById = new Map(programs.map((p) => [p.id, p]));

  for (const row of rows) {
    const latestAck = latestAcknowledgementForWorker(
      employeeId,
      row.program.id,
      acknowledgements,
    );
    const flow = deriveTrainingFlowState({
      program: row.program,
      assignment: row.assignment,
      latestAck,
      effectiveStatus: row.status,
    });

    if (flow.fullyCertified) certifiedCount += 1;
    if (flow.part1Complete) part1CompleteCount += 1;
    if (flow.needsWorkerAction) part1ActionCount += 1;
    if (flow.step === "shadow_pending") fieldTrainingCount += 1;

    const attempts = row.assignment?.quiz_attempt_count ?? 0;
    if (attempts > 0) {
      quizAttemptSum += attempts;
      quizAttemptRows += 1;
    }

    const itemStatus = itemStatusFromFlow(flow);
    const cat = classifyMyLearningCategory(row.program);
    itemsByCategory.get(cat)!.push({
      programId: row.program.id,
      name: row.program.title,
      status: itemStatus,
      flowStep: flow.step,
      progressLabel: flow.tag,
      flowDetail: flow.detail,
      tier: row.program.tier,
      assignmentStatus: row.status,
      quizAttempts: attempts,
    });

    flowByProgramId.set(row.program.id, flow);
  }

  const bundleTrack = buildMyLearningBundleTrack(bundles, {
    programsById,
    flowByProgramId,
    alertByProgramId: alertByProgram,
  });

  const total = rows.length;
  const part1Percent = total > 0 ? Math.round((part1CompleteCount / total) * 100) : 0;

  for (const [, items] of itemsByCategory) {
    items.sort((a, b) => {
      const rank = (s: MyLearningItemStatus) =>
        s === "action_needed" ? 0 : s === "in_progress" ? 1 : s === "part1_done" ? 2 : 3;
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      return a.name.localeCompare(b.name);
    });
  }

  const categories: MyLearningCategory[] = CATEGORY_ORDER.map((id) => {
    const items = itemsByCategory.get(id) ?? [];
    const totalCat = items.length;
    const certified = items.filter((i) => i.status === "certified").length;
    const part1Complete = items.filter(
      (i) => i.status === "certified" || i.status === "part1_done",
    ).length;
    const percent = totalCat > 0 ? Math.round((certified / totalCat) * 100) : 0;
    const meta = CATEGORY_META[id];
    return {
      id,
      title: meta.title,
      certified,
      part1Complete,
      total: totalCat,
      percent,
      ringColor: meta.ringColor,
      gradient: meta.gradient,
      items,
    };
  }).filter((c) => c.total > 0);

  const avgQuizAttempts =
    quizAttemptRows > 0 ? Math.round((quizAttemptSum / quizAttemptRows) * 10) / 10 : null;

  return {
    stats: {
      part1Percent,
      part1Description: `${part1CompleteCount} of ${total} — online training complete (read, ack, 100% quiz)`,
      part1ActionCount,
      part1ActionDescription:
        part1ActionCount === 1
          ? "Procedure needs your action in Part 1"
          : "Procedures need your action in Part 1",
      fieldTrainingCount,
      fieldTrainingDescription:
        fieldTrainingCount === 1
          ? "Awaiting shadow shift & supervisor sign-off"
          : "Awaiting shadow shifts & supervisor sign-off",
      certifiedCount,
      certifiedDescription:
        certifiedCount === 1
          ? "Fully certified (Part 1 + Part 2)"
          : "Fully certified (Part 1 + Part 2)",
      avgQuizAttempts,
    },
    categories,
    bundleTrack,
    recentActivity: buildActivity(programs, assignments, acknowledgements),
  };
}

/** Rows for category progress rings — certified = both parts complete. */
export function myLearningProgressCategories(model: MyLearningDashboardModel): MyLearningCategory[] {
  return model.categories;
}
