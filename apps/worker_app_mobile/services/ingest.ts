import { api } from "@/services/api";

export async function ingestEvent(body: {
  event_type: string;
  payload: Record<string, unknown>;
  source?: string;
}): Promise<{ accepted: boolean; correlation_id?: string }> {
  const { data } = await api.post("/api/v1/core/ingest", body);
  return data;
}

export async function ackCaughtUp(): Promise<void> {
  await ingestEvent({
    event_type: "worker.acknowledged",
    payload: { action: "floor_confirm", at: new Date().toISOString() },
    source: "worker_mobile",
  });
}

export async function requestHelp(): Promise<void> {
  await ingestEvent({
    event_type: "worker.help_requested",
    payload: { at: new Date().toISOString() },
    source: "worker_mobile",
  });
}
