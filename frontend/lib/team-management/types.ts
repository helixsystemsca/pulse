import type { WorkerRow } from "@/lib/workersService";
import type { WorkerDevelopmentSummary } from "@/lib/team-management/development-types";

/** Unified employee record for Team Management — roster is source of truth. */
export type TeamEmployee = WorkerRow & {
  development?: WorkerDevelopmentSummary;
};

export type TeamQuadrantCounts = Record<"A" | "B" | "C" | "D", number>;

export type TeamOverviewMilestone = {
  id: string;
  userId: string;
  employeeName: string;
  title: string;
  scheduledDate: string | null;
  status: string;
};

export type TeamOverviewData = {
  employees: TeamEmployee[];
  quadrantCounts: TeamQuadrantCounts;
  reviewsDue: WorkerDevelopmentSummary[];
  developmentMilestones: TeamOverviewMilestone[];
  onTrackCount: number;
  needsAttentionCount: number;
  lastUpdatedAt: string | null;
};
