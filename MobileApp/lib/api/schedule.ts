import { apiFetch } from "./client";

export type Shift = {
  id: string;
  startsAt: string;
  endsAt: string;
  zoneLabel?: string | null;
};

export async function listMySchedule(token: string): Promise<Shift[]> {
  return apiFetch<Shift[]>("/api/mobile/schedule", { token });
}

