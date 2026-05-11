/** HTML5 drag payload for schedule shift chips (move vs Shift+duplicate). */

import type { DragEvent } from "react";
import type { ScheduleDragSession } from "./types";

export const SHIFT_DRAG_MIME = "application/x-pulse-shift";
export const WORKER_DRAG_MIME = "application/x-pulse-schedule-worker";
export const PALETTE_DRAG_MIME = "application/x-pulse-schedule-palette";

function listDataTransferTypes(dt: DataTransfer): string[] {
  try {
    return Array.from(dt.types ?? []);
  } catch {
    return [];
  }
}

/**
 * Calendar / week cells call `preventDefault` on dragover only when this is true.
 * Some browsers omit custom MIME types from `dataTransfer.types` until drop; the live
 * `dragSession` from `dragstart` (prefer `flushSync` when setting it) must be trusted.
 */
export function scheduleCalendarDragOverAccepts(e: DragEvent, dragSession: ScheduleDragSession | null): boolean {
  if (dragSession?.kind === "worker" || dragSession?.kind === "shift" || dragSession?.kind === "palette") return true;
  return listDataTransferTypes(e.dataTransfer).some(
    (t) => t === SHIFT_DRAG_MIME || t === WORKER_DRAG_MIME || t === PALETTE_DRAG_MIME,
  );
}

/** Day panel accepts worker drops only (not shift moves). */
export function scheduleDayWorkerDropZoneAccepts(e: DragEvent, dragSession: ScheduleDragSession | null): boolean {
  if (dragSession?.kind === "worker") return true;
  if (dragSession?.kind === "shift") return false;
  return listDataTransferTypes(e.dataTransfer).includes(WORKER_DRAG_MIME);
}

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
    "position:fixed;left:0;top:0;padding:8px 12px;font-size:12px;font-weight:600;border-radius:10px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(44,58,85,.12);color:#2c3a55;z-index:2147483647;pointer-events:none;";
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, 12, 12);
  requestAnimationFrame(() => el.remove());
}

export type WorkerDragPayload = { workerId: string };

export function setWorkerDragData(dt: DataTransfer, payload: WorkerDragPayload) {
  dt.setData(WORKER_DRAG_MIME, JSON.stringify(payload));
  dt.setData("text/plain", payload.workerId);
  dt.effectAllowed = "copy";
}

export function readWorkerDragPayload(dt: DataTransfer): WorkerDragPayload | null {
  try {
    const raw = dt.getData(WORKER_DRAG_MIME);
    if (!raw) return null;
    const o = JSON.parse(raw) as WorkerDragPayload;
    if (typeof o.workerId === "string") return o;
    return null;
  } catch {
    return null;
  }
}

export type PaletteDragPayload = { paletteKind: "shift" | "badge"; code: string };

export function setPaletteDragData(dt: DataTransfer, payload: PaletteDragPayload) {
  dt.setData(PALETTE_DRAG_MIME, JSON.stringify(payload));
  dt.setData("text/plain", `${payload.paletteKind}:${payload.code}`);
  dt.effectAllowed = "copy";
}

export function readPaletteDragPayload(dt: DataTransfer): PaletteDragPayload | null {
  try {
    const raw = dt.getData(PALETTE_DRAG_MIME);
    if (!raw) return null;
    const o = JSON.parse(raw) as PaletteDragPayload;
    if ((o.paletteKind === "shift" || o.paletteKind === "badge") && typeof o.code === "string" && o.code.trim()) {
      return { paletteKind: o.paletteKind, code: o.code.trim() };
    }
    return null;
  } catch {
    return null;
  }
}

export function attachWorkerDragPreview(e: { dataTransfer: DataTransfer }, workerName: string): void {
  const el = document.createElement("div");
  el.textContent = `Assign ${workerName}`;
  el.style.cssText =
    "position:fixed;left:0;top:0;padding:8px 12px;font-size:12px;font-weight:600;border-radius:10px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 4px 14px rgba(44,58,85,.12);color:#2c3a55;z-index:2147483647;pointer-events:none;max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
  document.body.appendChild(el);
  e.dataTransfer.setDragImage(el, 12, 12);
  requestAnimationFrame(() => el.remove());
}
