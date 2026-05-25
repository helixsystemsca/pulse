export type RoutineBadgeKind = "EXTRA" | "GROUNDS";

export type RoutineBadgeDragPayload = {
  badgeKind: RoutineBadgeKind;
};

const MIME = "application/x-pulse-routine-badge";

export function setRoutineBadgeDragData(
  dt: DataTransfer,
  payload: RoutineBadgeDragPayload,
): void {
  dt.setData(MIME, JSON.stringify(payload));
  dt.effectAllowed = "copy";
}

export function readRoutineBadgeDragPayload(
  dt: DataTransfer,
): RoutineBadgeDragPayload | null {
  const raw = dt.getData(MIME);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RoutineBadgeDragPayload;
      if (parsed?.badgeKind === "EXTRA" || parsed?.badgeKind === "GROUNDS") return parsed;
    } catch {
      /* ignore */
    }
  }
  const plain = dt.getData("text/plain").trim().toLowerCase();
  if (plain === "extra") return { badgeKind: "EXTRA" };
  if (plain === "grounds") return { badgeKind: "GROUNDS" };
  return null;
}

export function routineBadgeDropZoneAccepts(
  e: React.DragEvent,
  draggingBadge: RoutineBadgeKind | null,
): boolean {
  try {
    if (Array.from(e.dataTransfer.types ?? []).includes(MIME)) return true;
  } catch {
    /* ignore */
  }
  return draggingBadge === "EXTRA" || draggingBadge === "GROUNDS";
}
