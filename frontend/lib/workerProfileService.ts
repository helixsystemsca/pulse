import { apiFetch } from "@/lib/api";

export type WorkerProfileBadge = {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  category: string;
  unlockedAt?: string | null;
};

export type WorkerProfileXpRow = {
  id: string;
  amount: number;
  reasonCode: string;
  reason?: string | null;
  track: string;
  createdAt: string;
};

export type WorkerProfilePayload = {
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
  bestStreak: number;
  lastStreakActivityDate?: string | null;
  avatarBorder?: string | null;
  unlockedAvatarBorders: string[];
  badges: WorkerProfileBadge[];
  recentXp: WorkerProfileXpRow[];
  generatedAt: string;
};

export async function fetchWorkerProfile(userId: string): Promise<WorkerProfilePayload> {
  return apiFetch<WorkerProfilePayload>(`/api/v1/users/${encodeURIComponent(userId)}/profile`);
}

