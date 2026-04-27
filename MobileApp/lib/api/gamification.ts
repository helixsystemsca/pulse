import { apiFetch } from "./client";

export type WorkerGamification = {
  user_id: string;
  full_name: string | null;
  total_xp: number;
  level: number;
  xp_to_next_level: number;
  streak_days: number;
  badges: Array<{ id: string; label: string; earned_at: string }>;
  rank?: number | null;
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  display_name: string;
  total_xp: number;
  level: number;
  is_me: boolean;
};

export type WorkerCertification = {
  code: string;
  label: string;
  expires_at: string | null;
  days_until_expiry: number | null;
};

type GamificationMeResponse = {
  analytics: {
    totalXp: number;
    level: number;
    xpToNextLevel?: number;
    streak?: number;
  };
  unlockedBadges?: Array<{ id: string; label?: string; name?: string; earnedAt?: string }>;
};

export async function getMyGamification(token: string, userId: string): Promise<WorkerGamification> {
  try {
    const me = await apiFetch<GamificationMeResponse>("/api/v1/gamification/me", { token });
    const a = me.analytics;
    const tx = a.totalXp ?? 0;
    const lvl = a.level ?? 1;
    const badges = (me.unlockedBadges ?? []).map((b, i) => ({
      id: String(b.id ?? i),
      label: String(b.label ?? b.name ?? "Badge"),
      earned_at: b.earnedAt ?? new Date().toISOString(),
    }));
    return {
      user_id: userId,
      full_name: null,
      total_xp: tx,
      level: lvl,
      xp_to_next_level: a.xpToNextLevel ?? Math.max(1, 100 - (tx % 100)),
      streak_days: a.streak ?? 0,
      badges,
      rank: null,
    };
  } catch {
    const analytics = await apiFetch<{
      totalXp: number;
      level: number;
      xpToNextLevel?: number;
      streak?: number;
    }>(`/api/v1/users/${encodeURIComponent(userId)}/analytics`, { token });
    const tx = analytics.totalXp ?? 0;
    return {
      user_id: userId,
      full_name: null,
      total_xp: tx,
      level: analytics.level ?? 1,
      xp_to_next_level: analytics.xpToNextLevel ?? Math.max(1, 100 - (tx % 100)),
      streak_days: analytics.streak ?? 0,
      badges: [],
      rank: null,
    };
  }
}

export async function getLeaderboard(token: string): Promise<LeaderboardEntry[]> {
  try {
    return await apiFetch<LeaderboardEntry[]>("/api/v1/gamification/leaderboard", { token });
  } catch {
    return [];
  }
}

export async function getMyCertifications(token: string): Promise<WorkerCertification[]> {
  try {
    return await apiFetch<WorkerCertification[]>("/api/v1/workers/me/certifications", { token });
  } catch {
    return [];
  }
}
