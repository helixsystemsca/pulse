import { apiFetch } from "@/lib/api";

export type TeamInsightsBadge = {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  category: string;
  unlockedAt?: string | null;
};

export type TeamInsightsWorker = {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  roles: string[];
  avatarUrl?: string | null;
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpToNextLevel: number;
  streak: number;
  lastStreakActivityDate?: string | null;
  avatarBorder?: string | null;
  badges: TeamInsightsBadge[];
};

export type TeamInsightsActivity = {
  createdAt: string;
  userId: string;
  userName: string;
  kind: string;
  message: string;
  xpDelta: number;
};

export type TeamInsightsSummary = {
  totalTeamXp: number;
  activeStreaks: number;
  topPerformerUserId?: string | null;
  topPerformerName?: string | null;
  topPerformerWeekXp: number;
  mostImprovedUserId?: string | null;
  mostImprovedName?: string | null;
  mostImprovedDelta: number;
};

export type TeamInsightsHighlightPerson = {
  userId: string;
  fullName: string;
  score: number;
};

export type TeamInsightsXpHighlights = {
  topContributorsWeek: TeamInsightsHighlightPerson[];
  reliabilityLeaders: TeamInsightsHighlightPerson[];
  crossTrainingLeaders: TeamInsightsHighlightPerson[];
  complianceLeaders: TeamInsightsHighlightPerson[];
};

export type TeamInsightsPayload = {
  summary: TeamInsightsSummary;
  workers: TeamInsightsWorker[];
  recentActivity: TeamInsightsActivity[];
  xpHighlights?: TeamInsightsXpHighlights;
};

export async function fetchTeamInsights(): Promise<TeamInsightsPayload> {
  // Primary route
  return apiFetch<TeamInsightsPayload>("/api/v1/team/insights");
}

