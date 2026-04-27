import { apiFetch } from "./client";

export type AssignedTool = {
  id: string;
  label: string;
  mac_address: string;
  type: string;
  last_seen_zone?: string | null;
  last_seen_at?: string | null;
  position_confidence?: number | null;
  status: "online" | "offline" | "missing";
};

export async function listMyTools(token: string, userId: string): Promise<AssignedTool[]> {
  return apiFetch<AssignedTool[]>(
    `/api/v1/ble-devices?assigned_worker_id=${encodeURIComponent(userId)}`,
    { token },
  );
}

