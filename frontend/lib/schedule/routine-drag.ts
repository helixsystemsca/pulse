/** HTML5 drag payload for schedule routines board (routine chip → worker row). */

import type { DragEvent } from "react";

export const ROUTINE_DRAG_MIME = "application/x-pulse-routine";

export type RoutineDragPayload = { routineId: string };

export function setRoutineDragData(dt: DataTransfer, payload: RoutineDragPayload) {
  dt.setData(ROUTINE_DRAG_MIME, JSON.stringify(payload));
  dt.setData("text/plain", payload.routineId);
  dt.effectAllowed = "copy";
}

export function readRoutineDragPayload(dt: DataTransfer): RoutineDragPayload | null {
  try {
    const raw = dt.getData(ROUTINE_DRAG_MIME);
    if (raw) {
      const o = JSON.parse(raw) as RoutineDragPayload;
      if (typeof o.routineId === "string" && o.routineId.trim()) return { routineId: o.routineId.trim() };
    }
  } catch {
    /* fall through */
  }
  const plain = dt.getData("text/plain").trim();
  if (plain.length >= 8 && plain.includes("-")) return { routineId: plain };
  return null;
}

export function routineDropZoneAccepts(e: DragEvent, draggingRoutineId: string | null): boolean {
  if (draggingRoutineId) return true;
  try {
    return Array.from(e.dataTransfer.types ?? []).includes(ROUTINE_DRAG_MIME);
  } catch {
    return false;
  }
}

export function attachRoutineDragPreview(e: { dataTransfer: DataTransfer }, routineName: string): void {
  const el = document.createElement("div");
  el.textContent = routineName;
  el.style.cssText =
    "position:fixed;left:0;top:0;padding:8px 12px;font-size:12px;font-weight:600;border-radius:10px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(44,58,85,.12);color:#2c3a55;z-index:2147483647;pointer-events:none;max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, 12, 12);
  requestAnimationFrame(() => el.remove());
}
