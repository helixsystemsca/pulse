import { apiFetch } from "./client";

export type Task = {
  id: string;
  title: string;
  status: "open" | "in_progress" | "completed";
  dueAt?: string | null;
};

export async function listMyTasks(token: string): Promise<Task[]> {
  return apiFetch<Task[]>("/api/mobile/tasks", { token });
}

export async function startTask(token: string, taskId: string): Promise<void> {
  return apiFetch<void>(`/api/mobile/tasks/${taskId}/start`, { method: "POST", token });
}

export async function completeTask(token: string, taskId: string, note?: string): Promise<void> {
  return apiFetch<void>(`/api/mobile/tasks/${taskId}/complete`, { method: "POST", body: { note }, token });
}

