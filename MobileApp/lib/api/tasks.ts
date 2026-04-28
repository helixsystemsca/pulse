import { apiFetch } from "./client";

export type Task = {
  id: string;
  title: string;
  description?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  source_type: "work_order" | "pm" | "project" | "routine" | "self";
  source_id?: string | null;
  equipment_id?: string | null;
  status: "todo" | "in_progress" | "done";
  due_date?: string | null;
  priority?: number;
  difficulty?: number;
  xp_awarded?: number;
  created_at?: string;
  completed_at?: string | null;
};

export async function listMyTasks(token: string): Promise<Task[]> {
  // Include both todo + in_progress; the API supports filtering, but only one status at a time.
  return apiFetch<Task[]>("/api/v1/tasks/my", { token });
}

export async function getNextTask(token: string): Promise<Task | null> {
  return apiFetch<Task | null>("/api/v1/tasks/next", { token });
}

export async function getUpcomingTasks(token: string, limit = 3): Promise<Task[]> {
  return apiFetch<Task[]>(`/api/v1/tasks/upcoming?limit=${limit}`, { token });
}

export type WorkOrderBrief = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  work_order_type: string;
  equipment_id?: string | null;
  part_id?: string | null;
  procedure_id?: string | null;
  due_date?: string | null;
  assigned_user_id?: string | null;
  attachments: unknown[];
  created_at: string;
  updated_at: string;
};

export type TaskFullPayload = {
  task: Task;
  work_order: WorkOrderBrief | null;
  procedures: { id: string; title: string; steps: unknown[] }[];
  parts: {
    part_id: string;
    quantity: number;
    name?: string | null;
    description?: string | null;
    equipment_id?: string | null;
  }[];
  attachments: unknown[];
  equipment_history: {
    id: string;
    title: string;
    status: string;
    updated_at: string;
    work_order_type?: string | null;
  }[];
};

export async function getTaskFull(token: string, taskId: string): Promise<TaskFullPayload> {
  return apiFetch<TaskFullPayload>(`/api/v1/tasks/${taskId}/full`, { token });
}

export async function startTask(token: string, taskId: string): Promise<void> {
  // Phase 1: only completion is wired for the XP system; "start" can be added later.
  return apiFetch<void>(`/api/v1/tasks/${taskId}/start`, { method: "POST", token });
}

export type CompleteTaskResult = {
  xp: number;
  totalXp: number;
  level: number;
  xpIntoLevel?: number;
  xpToNextLevel?: number;
  leveledUp?: boolean;
  newBadges?: Array<{ id: string; name: string; description: string; iconKey: string; category: string; unlockedAt?: string | null }>;
  reason?: string | null;
  xpBreakdown?: Record<string, number> | null;
};

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
  xpWorker?: number;
  xpLead?: number;
  xpSupervisor?: number;
};

export async function getUserAnalytics(token: string, userId: string): Promise<UserAnalytics> {
  return apiFetch<UserAnalytics>(`/api/v1/users/${userId}/analytics`, { token });
}

