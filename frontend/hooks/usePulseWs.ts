import { getApiBaseUrl, getTenantApiBearerToken } from "@/lib/api";
import { tryRefreshAccessToken } from "@/lib/auth-refresh";
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

/** Auth-related close codes from `backend/app/api/realtime.py`. */
const WS_AUTH_CLOSE_CODES = new Set([4401, 4403]);

function closeSocketQuietly(ws: WebSocket) {
  ws.onclose = null;
  if (ws.readyState === WebSocket.OPEN) {
    ws.close(1000);
    return;
  }
  if (ws.readyState === WebSocket.CONNECTING) {
    ws.onopen = () => ws.close(1000);
  }
}

export function usePulseWs(
  onEvent: (evt: PulseWsEvent) => void,
  enabled: boolean,
  accessToken?: string | null,
) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const base = getApiBaseUrl();
    if (!base) return;

    let cancelled = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let authRefreshAttempted = false;

    const connect = (tokenOverride?: string | null) => {
      if (cancelled) return;
      const token = tokenOverride ?? accessToken ?? getTenantApiBearerToken();
      if (!token) return;

      const url = `${wsBaseFromHttpBase(base)}/api/v1/ws?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (cancelled && ws) {
          closeSocketQuietly(ws);
        }
      };

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(String(msg.data)) as PulseWsEvent;
          onEventRef.current(parsed);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = (ev) => {
        if (cancelled) return;
        if (WS_AUTH_CLOSE_CODES.has(ev.code) && !authRefreshAttempted) {
          authRefreshAttempted = true;
          void (async () => {
            const refreshed = await tryRefreshAccessToken();
            if (refreshed && !cancelled) {
              connect(getTenantApiBearerToken());
            }
          })();
          return;
        }
        if (ev.code === 1000 || WS_AUTH_CLOSE_CODES.has(ev.code)) return;
        reconnectTimer = setTimeout(() => connect(), 5000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) closeSocketQuietly(ws);
    };
  }, [enabled, accessToken]);
}
