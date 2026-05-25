import type { EmployeeComplianceAlert } from "@/lib/training/complianceAlerts";
import { myProcedureRowsForWorker } from "@/lib/training/selectors";
import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingAssignmentStatus,
  TrainingProgram,
  TrainingTier,
} from "@/lib/training/types";

export type MyLearningCategoryId = "arena_ops" | "pool_aquatics" | "emergency" | "maintenance";

export type MyLearningItemStatus = "complete" | "partial" | "incomplete";

export type MyLearningTrainingItem = {
  programId: string;
  name: string;
  status: MyLearningItemStatus;
  progressLabel: string;
  tier: TrainingTier;
  assignmentStatus: TrainingAssignmentStatus;
};

export type MyLearningCategory = {
  id: MyLearningCategoryId;
  title: string;
  completed: number;
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
  tier: TrainingTier;
  done: boolean;
};

export type MyLearningStats = {
  overallPercent: number;
  overallDescription: string;
  highRiskCount: number;
  highRiskDescription: string;
  routinesCount: number;
  routinesDescription: string;
  completedAckCount: number;
  completedDescription: string;
};

export type MyLearningDashboardModel = {
  stats: MyLearningStats;
  categories: MyLearningCategory[];
  checklist: MyLearningChecklistItem[];
  incompleteChecklistCount: number;
  recentAcknowledgements: {
    id: string;
    title: string;
    revision: number;
    dateLabel: string;
    at: string;
  }[];
};

const CATEGORY_META: Record<
  MyLearningCategoryId,
  { title: string; ringColor: string; gradient: string }
> = {
  arena_ops: {
    title: "Arena Operations",
    ringColor: "#10b981",
    gradient: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
  },
  pool_aquatics: {
    title: "Pool & Aquatics",
    ringColor: "#3b82f6",
    gradient: "linear-gradient(135deg, #56c9d9 0%, #4db8c4 100%)",
  },
  emergency: {
    title: "Emergency Response",
    ringColor: "#f59e0b",
    gradient: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
  },
  maintenance: {
    title: "Maintenance & Facilities",
    ringColor: "#8b5cf6",
    gradient: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
  },
};

const CATEGORY_ORDER: MyLearningCategoryId[] = [
  "arena_ops",
  "pool_aquatics",
  "emergency",
  "maintenance",
];

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export function classifyMyLearningCategory(program: TrainingProgram): MyLearningCategoryId {
  const title = norm(program.title);
  const cat = norm(program.category);
  const dept = norm(program.department_category);
  const tags = program.tracking_tags ?? [];

  if (program.tier === "high_risk" || tags.includes("emergency")) return "emergency";
  if (dept === "aquatics" || /\b(pool|aquatic|ice|changeroom|swim|weight)\b/.test(title)) {
    return "pool_aquatics";
  }
  if (/\b(arena|rink)\b/.test(title) || /\bshift\b/.test(title)) return "arena_ops";
  if (
    dept === "maintenance" ||
    /\b(mower|scrubber|blade|glade|field house|backwash|snow|maintenance|facility)\b/.test(title)
  ) {
    return "maintenance";
  }
  if (program.tier === "mandatory" || tags.includes("routine")) return "arena_ops";
  if (program.tier === "general") return "maintenance";
  return "maintenance";
}

export function myLearningItemStatus(status: TrainingAssignmentStatus): MyLearningItemStatus {
  if (status === "completed") return "complete";
  if (status === "expiring_soon") return "partial";
  return "incomplete";
}

function progressLabelFor(status: TrainingAssignmentStatus): string {
  if (status === "completed") return "Done";
  if (status === "expiring_soon") return "Expiring";
  if (status === "revision_pending") return "Rev due";
  if (status === "quiz_failed") return "Retry quiz";
  if (status === "expired") return "Expired";
  if (status === "pending") return "In progress";
  return "Action needed";
}

function countsAsComplete(status: TrainingAssignmentStatus): boolean {
  return status === "completed" || status === "expiring_soon";
}

function isCertificationTier(tier: TrainingTier): boolean {
  return tier === "mandatory" || tier === "high_risk";
}

export function buildMyLearningDashboard(input: {
  employeeId: string;
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
  acknowledgements: TrainingAcknowledgement[];
  alerts: EmployeeComplianceAlert[];
  trustAssignmentStatus?: boolean;
}): MyLearningDashboardModel {
  const { employeeId, programs, assignments, acknowledgements, alerts, trustAssignmentStatus } = input;

  const rows = myProcedureRowsForWorker(
    employeeId,
    programs,
    assignments,
    acknowledgements,
    { trustAssignmentStatus },
  );

  const certRows = rows.filter((r) => isCertificationTier(r.program.tier));
  const completedCert = certRows.filter((r) => r.status === "completed").length;
  const overallPercent =
    certRows.length > 0 ? Math.round((completedCert / certRows.length) * 100) : 0;

  const highRiskIncomplete = rows.filter(
    (r) => r.program.tier === "high_risk" && !countsAsComplete(r.status),
  ).length;
  const highRiskAlerts = alerts.filter((a) => a.tier === "high_risk").length;
  const highRiskCount = Math.max(highRiskIncomplete, highRiskAlerts);

  const routinesPending = rows.filter(
    (r) => r.program.tier === "mandatory" && !countsAsComplete(r.status),
  ).length;

  const recentAcknowledgements = [...acknowledgements]
    .sort((a, b) => b.acknowledged_at.localeCompare(a.acknowledged_at))
    .slice(0, 12)
    .map((k) => {
      const p = programs.find((x) => x.id === k.training_program_id);
      return {
        id: k.id,
        title: p?.title ?? k.training_program_id,
        revision: k.revision_number,
        dateLabel: k.acknowledged_at.slice(0, 10),
        at: k.acknowledged_at,
      };
    });

  const itemsByCategory = new Map<MyLearningCategoryId, MyLearningTrainingItem[]>();
  for (const id of CATEGORY_ORDER) itemsByCategory.set(id, []);

  for (const row of rows) {
    const cat = classifyMyLearningCategory(row.program);
    const itemStatus = myLearningItemStatus(row.status);
    itemsByCategory.get(cat)!.push({
      programId: row.program.id,
      name: row.program.title,
      status: itemStatus,
      progressLabel: progressLabelFor(row.status),
      tier: row.program.tier,
      assignmentStatus: row.status,
    });
  }

  for (const [, items] of itemsByCategory) {
    items.sort((a, b) => {
      const rank = (s: MyLearningItemStatus) =>
        s === "incomplete" ? 0 : s === "partial" ? 1 : 2;
      if (rank(a.status) !== rank(b.status)) return rank(a.status) - rank(b.status);
      return a.name.localeCompare(b.name);
    });
  }

  const categories: MyLearningCategory[] = CATEGORY_ORDER.map((id) => {
    const items = itemsByCategory.get(id) ?? [];
    const total = items.length;
    const completed = items.filter((i) => i.status === "complete").length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const meta = CATEGORY_META[id];
    return {
      id,
      title: meta.title,
      completed,
      total,
      percent,
      ringColor: meta.ringColor,
      gradient: meta.gradient,
      items,
    };
  }).filter((c) => c.total > 0);

  const alertByProgram = new Map(alerts.map((a) => [a.programId, a]));
  const checklist: MyLearningChecklistItem[] = rows
    .map((row) => {
      const alert = alertByProgram.get(row.program.id);
      const done = countsAsComplete(row.status);
      return {
        programId: row.program.id,
        title: row.program.title,
        meta: alert?.label ?? (done ? "Up to date" : progressLabelFor(row.status)),
        tier: row.program.tier,
        done,
      };
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      const tierOrder: TrainingTier[] = ["high_risk", "mandatory", "general"];
      const ta = tierOrder.indexOf(a.tier);
      const tb = tierOrder.indexOf(b.tier);
      if (ta !== tb) return ta - tb;
      return a.title.localeCompare(b.title);
    });

  const incompleteChecklistCount = checklist.filter((c) => !c.done).length;

  return {
    stats: {
      overallPercent,
      overallDescription: `${completedCert} of ${certRows.length} certification${certRows.length === 1 ? "" : "s"} complete`,
      highRiskCount,
      highRiskDescription:
        highRiskCount === 1 ? "Urgent training item" : "Urgent training items",
      routinesCount: routinesPending,
      routinesDescription:
        routinesPending === 1 ? "Standard procedure pending" : "Standard procedures pending",
      completedAckCount: acknowledgements.length,
      completedDescription:
        acknowledgements.length === 1
          ? "Acknowledgement on file"
          : "Acknowledgements on file",
    },
    categories,
    checklist,
    incompleteChecklistCount,
    recentAcknowledgements,
  };
}

/** Rows for category progress rings — include empty categories only when we have any assigned training. */
export function myLearningProgressCategories(model: MyLearningDashboardModel): MyLearningCategory[] {
  return model.categories;
}
