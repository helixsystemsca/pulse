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
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RoutineBadgeDragPayload;
    if (parsed?.badgeKind === "EXTRA" || parsed?.badgeKind === "GROUNDS") return parsed;
  } catch {
    /* ignore */
  }
  return null;
}

export function routineBadgeDropZoneAccepts(
  e: React.DragEvent,
  draggingBadge: RoutineBadgeKind | null,
): boolean {
  if (!draggingBadge) return false;
  return e.dataTransfer.types.includes(MIME);
}
