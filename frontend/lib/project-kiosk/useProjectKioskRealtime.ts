"use client";

import { useCallback, useEffect, useRef } from "react";
import { buildProjectKioskWebSocketUrl, realtimeMessageMayAffectProject } from "@/lib/project-kiosk/projectKioskWebSocket";

type Options = {
  projectId: string;
  enabled: boolean;
  /** Called when realtime suggests the project may have changed (debounced / coalesced). */
  onInvalidate: () => void;
  /** Coalesce bursts: wait this long after the last matching message before refresh. */
  debounceMs?: number;
};

/**
 * WebSocket-driven refresh for kiosk / project dashboard — **no polling**.
 * Uses the company realtime hub; reconnects with exponential backoff on close/error.
 */
export function useProjectKioskRealtime({ projectId, enabled, onInvalidate, debounceMs = 2000 }: Options) {
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  const requestInvalidate = useCallback(() => {
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      onInvalidate();
    }, debounceMs);
  }, [onInvalidate, debounceMs]);

  useEffect(() => {
    if (!enabled || !projectId) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const url = buildProjectKioskWebSocketUrl(projectId);
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (ev) => {
        if (typeof ev.data !== "string") return;
        if (realtimeMessageMayAffectProject(ev.data, projectId)) requestInvalidate();
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (cancelled) return;
        const n = ++attemptRef.current;
        const backoff = Math.min(30_000, 800 * 2 ** Math.min(n, 6));
        reconnectTimerRef.current = window.setTimeout(connect, backoff);
      };

      ws.onopen = () => {
        attemptRef.current = 0;
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
      try {
        wsRef.current?.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    };
  }, [enabled, projectId, requestInvalidate]);
}
