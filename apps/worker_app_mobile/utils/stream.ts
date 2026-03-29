import type { StreamEvent } from "@/utils/streamTypes";

export function isWorkerAlertEventType(eventType: string): boolean {
  const t = eventType.toLowerCase();
  return (
    t.includes("tool") ||
    t.includes("missing") ||
    t.includes("inventory") ||
    t.includes("maintenance") ||
    t.includes("notification")
  );
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
