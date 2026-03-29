import { api } from "@/services/api";

export type AssignedTool = {
  id: string;
  tag_id: string;
  name: string;
  status: string;
  zone_id: string | null;
};

export type SiteMissingTool = {
  id: string;
  tag_id: string;
  name: string;
  assigned_user_id: string | null;
};

export async function fetchWorkerTools(): Promise<AssignedTool[]> {
  const { data } = await api.get<AssignedTool[]>("/api/v1/tool-tracking/worker/tools");
  return data;
}

export async function fetchSiteMissing(): Promise<SiteMissingTool[]> {
  const { data } = await api.get<SiteMissingTool[]>("/api/v1/tool-tracking/worker/missing");
  return data;
}
