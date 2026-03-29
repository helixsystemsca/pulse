"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getToken } from "@/lib/api";

export type WorkerStreamEvent = {
  event_type: string;
  entity_id?: string | null;
  metadata?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  correlation_id?: string;
};

type Ctx = {
  status: "connecting" | "live" | "error" | "idle";
  lastEvent: WorkerStreamEvent | null;
  tick: number;
};

const WorkerStreamCtx = createContext<Ctx | null>(null);

export function WorkerStreamProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Ctx["status"]>("idle");
  const [lastEvent, setLastEvent] = useState<WorkerStreamEvent | null>(null);
  const [tick, setTick] = useState(0);

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
        const data = JSON.parse(e.data) as WorkerStreamEvent;
        setLastEvent(data);
        setTick((x) => x + 1);
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

  const value = useMemo(() => ({ status, lastEvent, tick }), [status, lastEvent, tick]);

  return <WorkerStreamCtx.Provider value={value}>{children}</WorkerStreamCtx.Provider>;
}

export function useWorkerStream() {
  const ctx = useContext(WorkerStreamCtx);
  if (!ctx) {
    throw new Error("useWorkerStream requires WorkerStreamProvider");
  }
  return ctx;
}

/** Events worth a push / buzz on the floor. */
export function isWorkerAlertEvent(ev: WorkerStreamEvent): boolean {
  const t = ev.event_type.toLowerCase();
  if (t.includes("missing")) return true;
  if (t.includes("low_stock")) return true;
  if (t === "notifications.alert") return true;
  if (t.includes("maintenance_inferred")) return true;
  if (Boolean(ev.metadata?.inference_derivation) && Number(ev.metadata?.confidence) >= 0.6) return true;
  return false;
}

export function alertTitleAndBody(ev: WorkerStreamEvent): { title: string; body: string } {
  const meta = (ev.metadata ?? ev.payload ?? {}) as Record<string, unknown>;
  const tag = meta.tag_id != null ? String(meta.tag_id) : "";
  const tool = meta.name != null ? String(meta.name) : "";
  switch (ev.event_type) {
    case "inventory.low_stock":
      return { title: "Low stock", body: `SKU ${meta.sku ?? tag}` };
    case "notifications.alert":
      return { title: "Alert", body: String(meta.message ?? "Check ops app") };
    default:
      return {
        title: ev.event_type.replace(/\./g, " "),
        body: tool || tag || JSON.stringify(meta).slice(0, 120),
      };
  }
}
