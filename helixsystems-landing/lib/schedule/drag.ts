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

/**
 * Custom drag preview so users see “Move” vs duplicate (+) while dragging.
 * Detaches after the current frame (browser captures snapshot for drag).
 */
export function attachShiftDragPreview(e: { dataTransfer: DataTransfer }, duplicate: boolean): void {
  const el = document.createElement("div");
  el.textContent = duplicate ? "+ Duplicate shift" : "Move shift";
  el.style.cssText =
    "position:fixed;left:0;top:0;padding:8px 12px;font-size:12px;font-weight:600;border-radius:10px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(15,23,42,.12);color:#0f172a;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, 12, 12);
  requestAnimationFrame(() => el.remove());
}
