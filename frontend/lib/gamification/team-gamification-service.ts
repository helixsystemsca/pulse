import { apiFetch } from "@/lib/api";

/** Legacy XP / badges roster API (`/api/v1/team/insights`). Not linked from product nav. */

export type GamificationBadge = {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  category: string;
  unlockedAt?: string | null;
};

export type GamificationWorker = {
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
  badges: GamificationBadge[];
};

export type GamificationActivity = {
  createdAt: string;
  userId: string;
  userName: string;
  kind: string;
  message: string;
  xpDelta: number;
};

export type GamificationSummary = {
  totalTeamXp: number;
  activeStreaks: number;
  topPerformerUserId?: string | null;
  topPerformerName?: string | null;
  topPerformerWeekXp: number;
  mostImprovedUserId?: string | null;
  mostImprovedName?: string | null;
  mostImprovedDelta: number;
};

export type GamificationHighlightPerson = {
  userId: string;
  fullName: string;
  score: number;
};

export type GamificationXpHighlights = {
  topContributorsWeek: GamificationHighlightPerson[];
  reliabilityLeaders: GamificationHighlightPerson[];
  crossTrainingLeaders: GamificationHighlightPerson[];
  complianceLeaders: GamificationHighlightPerson[];
};

export type GamificationPayload = {
  summary: GamificationSummary;
  workers: GamificationWorker[];
  recentActivity: GamificationActivity[];
  xpHighlights?: GamificationXpHighlights;
};

export async function fetchTeamGamification(): Promise<GamificationPayload> {
  return apiFetch<GamificationPayload>("/api/v1/team/insights");
}
