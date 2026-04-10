import { normalizeMacKey } from "@/lib/macNormalize";

const norm = (v?: unknown) => String(v ?? "").trim().toLowerCase();

export type DetectionTestTarget =
  | { kind: "ble"; deviceId: string; macKey: string }
  | { kind: "gateway"; gatewayId: string };

/** How the proximity row satisfied the test (MAC-only = no worker/equipment on payload). */
export type DetectionMatchType = "entity" | "mac_only";

const PROXIMITY_UPDATE = "proximity_update";

function macMatchesPayload(mk: string, p: Record<string, unknown>): boolean {
  const w = normalizeMacKey(String(p.worker_tag_mac ?? ""));
  const e = normalizeMacKey(String(p.equipment_tag_mac ?? ""));
  const m = normalizeMacKey(String(p.mac_address ?? ""));
  return w === mk || e === mk || m === mk;
}

/** `null` = no match; otherwise strict gateway/MAC rules with entity vs MAC-only classification. */
export function activityRowMatchesTest(
  target: DetectionTestTarget,
  row: {
    event_type?: string | null;
    payload: Record<string, unknown>;
    created_at: string | null;
  },
  minCreatedMs: number,
  nowMs: number = Date.now(),
): DetectionMatchType | null {
  if (!row.created_at) return null;
  const t = Date.parse(row.created_at);
  if (Number.isNaN(t) || t < minCreatedMs) return null;
  if (t > nowMs + 60_000) return null;
  if (t < nowMs - 60_000) return null;
  if (norm(row.event_type) !== PROXIMITY_UPDATE) return null;
  const p = row.payload ?? {};
  if (norm(p.distance) !== "near") return null;

  const wid = String(p.worker_id ?? "").trim();
  const eid = String(p.equipment_id ?? "").trim();
  const hasEntity = Boolean(wid || eid);

  if (target.kind === "ble") {
    const mk = target.macKey;
    if (!mk) return null;
    if (!macMatchesPayload(mk, p)) return null;
    return hasEntity ? "entity" : "mac_only";
  }

  const gid = String(p.gateway_id ?? "").trim();
  const wantGid = String(target.gatewayId ?? "").trim();
  if (!wantGid || gid !== wantGid) return null;
  return hasEntity ? "entity" : "mac_only";
}
