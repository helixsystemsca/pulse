import { getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import { useEffect, useRef } from "react";

export type PulseWsEvent = {
  event_type: string;
  entity_id?: string | null;
  metadata?: unknown;
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

export function usePulseWs(onEvent: (evt: PulseWsEvent) => void, enabled: boolean) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const base = getApiBaseUrl();
    const token = readSession()?.access_token;
    if (!base || !token) return;

    const wsBase = wsBaseFromHttpBase(base);
    const url = `${wsBase}/api/v1/ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(url);

    ws.onmessage = (msg) => {
      try {
        const parsed = JSON.parse(String(msg.data)) as PulseWsEvent;
        onEventRef.current(parsed);
      } catch {
        // ignore malformed
      }
    };

    return () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    };
  }, [enabled]);
}

