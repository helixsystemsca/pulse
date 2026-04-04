import type { StreamEvent } from "@/utils/streamTypes";

export type AlertPushTier = "critical" | "warning" | "info";

export function isWorkerAlertEventType(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return (
    t.includes("tool") ||
    t.includes("missing") ||
    t.includes("inventory") ||
    t.includes("maintenance") ||
    t.includes("notification") ||
    t.includes("alert") ||
    t.includes("sensor")
  );
}

export function inferAlertTier(ev: StreamEvent): AlertPushTier {
  const t = ev.event_type.toLowerCase();
  const meta = JSON.stringify(ev.metadata ?? ev.payload ?? {}).toLowerCase();
  if (t.includes("critical") || t.includes("safety") || t.includes("emergency") || meta.includes("critical")) {
    return "critical";
  }
  if (t.includes("missing") || t.includes("inventory") || t.includes("maintenance") || t.includes("warning")) {
    return "warning";
  }
  return "info";
}

export function streamEventTitleBody(ev: StreamEvent): { title: string; body: string } {
  const t = ev.event_type.replace(/\./g, " ");
  const meta = ev.metadata ?? ev.payload ?? {};
  const msg =
    typeof meta.message === "string"
      ? meta.message
      : typeof meta.detail === "string"
        ? meta.detail
        : JSON.stringify(meta).slice(0, 120);
  return { title: t, body: msg };
}
