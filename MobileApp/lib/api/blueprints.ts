import { apiFetch } from "./client";

export type BlueprintSummary = {
  id: string;
  name: string;
  created_at: string;
};

export type BlueprintElement = {
  id: string;
  type:
    | "zone"
    | "device"
    | "door"
    | "path"
    | "symbol"
    | "group"
    | "connection"
    | "rectangle"
    | "ellipse"
    | "polygon";
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  rotation?: number;
  locked?: boolean;
  name?: string | null;
  path_points?: number[] | null;
  layer_id?: string | null;
};

export type BlueprintDetail = BlueprintSummary & {
  updated_at: string;
  elements: BlueprintElement[];
  tasks?: unknown[];
  layers?: { id: string; name: string }[];
};

export async function listBlueprints(token: string): Promise<BlueprintSummary[]> {
  return apiFetch<BlueprintSummary[]>("/api/blueprints", { token });
}

export async function getBlueprint(token: string, blueprintId: string): Promise<BlueprintDetail> {
  return apiFetch<BlueprintDetail>(`/api/blueprints/${encodeURIComponent(blueprintId)}`, { token });
}

