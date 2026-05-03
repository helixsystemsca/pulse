import { getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

function httpToWsOrigin(base: string): string {
  const b = base.replace(/\/$/, "");
  if (b.startsWith("https://")) return `wss://${b.slice(8)}`;
  if (b.startsWith("http://")) return `ws://${b.slice(7)}`;
  return b;
}

/**
 * Canonical URL shape requested for project-scoped updates (`/projects/:id/updates`).
 * Today the backend exposes a **company-scoped** hub at `/api/v1/ws`; the kiosk client
 * connects there and throttles refetches. A dedicated project filter can replace this URL later.
 */
export function buildProjectKioskWebSocketUrl(projectId: string): string | null {
  void projectId;
  const base = getApiBaseUrl();
  const token = readSession()?.access_token;
  if (!base || !token) return null;
  return `${httpToWsOrigin(base)}/api/v1/ws?token=${encodeURIComponent(token)}`;
}

/** Heuristic: should a domain event prompt a kiosk refresh for this project? */
export function realtimeMessageMayAffectProject(jsonText: string, projectId: string): boolean {
  try {
    const msg = JSON.parse(jsonText) as {
      metadata?: { project_id?: string; task_id?: string };
      event_type?: string;
      entity_id?: string;
    };
    const pid = msg.metadata?.project_id;
    if (pid && pid === projectId) return true;
    const et = (msg.event_type || "").toLowerCase();
    if (et.includes("project") || et.includes("task") || et.includes("maintenance")) return true;
    return false;
  } catch {
    return false;
  }
}
