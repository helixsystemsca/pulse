/** HTML5 drag payload for schedule shift chips (move vs Shift+duplicate). */

export const SHIFT_DRAG_MIME = "application/x-pulse-shift";

export type ShiftDragPayload = {
  shiftId: string;
  /** True when user held Shift while starting drag — drop creates a copy. */
  duplicate: boolean;
};

export function setShiftDragData(dt: DataTransfer, payload: ShiftDragPayload) {
  dt.setData(SHIFT_DRAG_MIME, JSON.stringify(payload));
  dt.setData("text/plain", payload.shiftId);
  dt.effectAllowed = payload.duplicate ? "copy" : "move";
}

export function readShiftDragPayload(dt: DataTransfer): ShiftDragPayload | null {
  try {
    const raw = dt.getData(SHIFT_DRAG_MIME);
    if (!raw) return null;
    const o = JSON.parse(raw) as ShiftDragPayload;
    if (typeof o.shiftId === "string" && typeof o.duplicate === "boolean") return o;
    return null;
  } catch {
    return null;
  }
}
