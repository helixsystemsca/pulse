"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getToken } from "@/lib/api";

export type StreamEvent = {
  event_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  correlation_id?: string;
  source_module?: string | null;
  occurred_at?: string;
};

export type AlertSeverity = "danger" | "warning" | "success" | "info";

export function getAlertSeverity(eventType: string, metadata: Record<string, unknown>): AlertSeverity {
  const t = eventType.toLowerCase();
  if (
    t.includes("missing") ||
    t.includes("low_stock") ||
    t === "notifications.alert" ||
    t === "inventory.low_stock"
  ) {
    return "danger";
  }
  if (
    t.includes("maintenance_inferred") ||
    t === "maintenance.inference_due" ||
    Boolean(metadata.inference_derivation && Number(metadata.confidence) < 0.6)
  ) {
    return "warning";
  }
  if (t === "tool_assigned" || t === "tool.assigned") {
    return "success";
  }
  return "info";
}

export function isAlertWorthy(ev: StreamEvent): boolean {
  const t = ev.event_type.toLowerCase();
  if (t.startsWith("tenant.") || t === "notifications.rule_created" || t === "job.created") {
    return false;
  }
  if (t.includes("missing") || t.includes("low_stock") || t.includes("alert")) return true;
  if (t.includes("maintenance") && (t.includes("inferred") || t.includes("inference"))) return true;
  if (t === "tool_assigned" || t === "tool.assigned") return true;
  if (ev.metadata?.inference_derivation) return true;
  return false;
}

export function streamMetadata(ev: StreamEvent): Record<string, unknown> {
  return (ev.metadata ?? ev.payload ?? {}) as Record<string, unknown>;
}

type RealtimeCtx = {
  status: "connecting" | "live" | "error" | "idle";
  events: StreamEvent[];
  alertItems: StreamEvent[];
  activityItems: StreamEvent[];
  getSeverity: (ev: StreamEvent) => AlertSeverity;
  clearEvents: () => void;
};

const Ctx = createContext<RealtimeCtx | null>(null);

const MAX_EVENTS = 120;

export function AdminRealtimeProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [status, setStatus] = useState<RealtimeCtx["status"]>("idle");

  const wsUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return `${base.replace(/^http/, "ws")}/api/v1/ws`;
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || !wsUrl) {
      setStatus("idle");
      return;
    }
    setStatus("connecting");
    const ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
    ws.onopen = () => setStatus("live");
    ws.onclose = () => setStatus("idle");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as StreamEvent;
        setEvents((prev) => [data, ...prev].slice(0, MAX_EVENTS));
      } catch {
        /* ignore */
      }
    };
    const ping = setInterval(() => {
      try {
        ws.send("ping");
      } catch {
        /* closed */
      }
    }, 25000);
    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, [wsUrl]);

  const alertItems = useMemo(() => events.filter(isAlertWorthy).slice(0, 25), [events]);
  const activityItems = useMemo(() => events.slice(0, 40), [events]);

  const getSeverity = useCallback((ev: StreamEvent) => getAlertSeverity(ev.event_type, streamMetadata(ev)), []);

  const clearEvents = useCallback(() => setEvents([]), []);

  const value = useMemo(
    () => ({ status, events, alertItems, activityItems, getSeverity, clearEvents }),
    [status, events, alertItems, activityItems, getSeverity, clearEvents],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdminRealtime() {
  const x = useContext(Ctx);
  if (!x) {
    throw new Error("useAdminRealtime requires AdminRealtimeProvider");
  }
  return x;
}
