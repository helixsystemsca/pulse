/** Drag payload for chips already on a worker row (remove via trash drop zone). */

export type AssignedRoutineChipDragPayload = {
  source: "assigned-routine";
  rowKey: string;
  workerId: string;
  listIndex: number;
  routineId: string;
  assignmentId?: string;
  label: string;
};

export type AssignedOperationalChipDragPayload = {
  source: "assigned-operational";
  rowKey: string;
  workerId: string;
  code: string;
  label: string;
};

export type AssignedChipDragPayload =
  | AssignedRoutineChipDragPayload
  | AssignedOperationalChipDragPayload;

const MIME = "application/x-pulse-assigned-chip";

export function setAssignedChipDragData(dt: DataTransfer, payload: AssignedChipDragPayload): void {
  dt.setData(MIME, JSON.stringify(payload));
  dt.effectAllowed = "move";
}

export function readAssignedChipDragPayload(dt: DataTransfer): AssignedChipDragPayload | null {
  const raw = dt.getData(MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AssignedChipDragPayload;
    if (parsed?.source === "assigned-operational") {
      if (!parsed.workerId || !parsed.code) return null;
      return parsed;
    }
    if (parsed?.source === "assigned-routine") {
      if (!parsed.workerId || !parsed.routineId || typeof parsed.listIndex !== "number") return null;
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function assignedChipTrashAccepts(e: React.DragEvent): boolean {
  try {
    return Array.from(e.dataTransfer.types ?? []).includes(MIME);
  } catch {
    return false;
  }
}
