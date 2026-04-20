import { apiFetch } from "./client";

export type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  due_date?: string | null;
  source_type?: "work_order" | "pm" | "project" | "routine" | "self";
  priority?: number;
  difficulty?: number;
  xp_awarded?: number;
};

export async function listMyTasks(token: string): Promise<Task[]> {
  return apiFetch<Task[]>("/api/v1/tasks/my?status=todo", { token });
}

export async function startTask(token: string, taskId: string): Promise<void> {
  // Phase 1: only completion is wired for the XP system; "start" can be added later.
  return apiFetch<void>(`/api/v1/tasks/${taskId}/start`, { method: "POST", token });
}

export type CompleteTaskResult = { xp: number; totalXp: number; level: number };

export async function completeTask(token: string, taskId: string): Promise<CompleteTaskResult> {
  return apiFetch<CompleteTaskResult>(`/api/v1/tasks/${taskId}/complete`, { method: "POST", token });
}

export type UserAnalytics = {
  totalXp: number;
  level: number;
  tasksCompleted: number;
  onTimeRate: number;
  avgCompletionTime: number;
  reviewScore: number;
  initiativeScore: number;
};

export async function getUserAnalytics(token: string, userId: string): Promise<UserAnalytics> {
  return apiFetch<UserAnalytics>(`/api/v1/users/${userId}/analytics`, { token });
}

