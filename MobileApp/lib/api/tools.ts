import { apiFetch } from "./client";

export type Tool = {
  id: string;
  name: string;
  status: "assigned_ok" | "missing" | "unknown";
};

export async function listMyTools(token: string): Promise<Tool[]> {
  return apiFetch<Tool[]>("/api/mobile/tools", { token });
}

export async function checkOutTool(token: string, toolId: string): Promise<void> {
  return apiFetch<void>(`/api/mobile/tools/${toolId}/check-out`, { method: "POST", token });
}

export async function checkInTool(token: string, toolId: string): Promise<void> {
  return apiFetch<void>(`/api/mobile/tools/${toolId}/check-in`, { method: "POST", token });
}

