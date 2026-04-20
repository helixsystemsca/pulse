import { getApiBaseUrl } from "@/lib/api/client";

export type PulseWsEvent = {
  event_type?: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  payload?: unknown;
  correlation_id?: string;
  source_module?: string | null;
  occurred_at?: string;
};

function wsBaseFromHttpBase(httpBase: string): string {
  if (httpBase.startsWith("https://")) return `wss://${httpBase.slice("https://".length)}`;
  if (httpBase.startsWith("http://")) return `ws://${httpBase.slice("http://".length)}`;
  return httpBase;
}

/** Subscribe to company-scoped domain events (same contract as web `usePulseWs`). */
export function subscribePulseWs(token: string, onEvent: (evt: PulseWsEvent) => void): () => void {
  const base = getApiBaseUrl();
  if (!base || !token) {
    return () => {};
  }
  const wsBase = wsBaseFromHttpBase(base);
  const url = `${wsBase.replace(/\/$/, "")}/api/v1/ws?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(url);
  ws.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(String(msg.data)) as PulseWsEvent;
      onEvent(parsed);
    } catch {
      /* ignore */
    }
  };
  return () => {
    try {
      ws.close();
    } catch {
      /* ignore */
    }
  };
}
