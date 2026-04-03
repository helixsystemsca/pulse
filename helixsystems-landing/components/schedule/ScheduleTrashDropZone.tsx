"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { readShiftDragPayload, SHIFT_DRAG_MIME } from "@/lib/schedule/drag";

type Props = {
  active: boolean;
  isDuplicateDrag?: boolean;
  onDropTrash: (shiftId: string) => void;
  /** When trash is hovered, parent should disable calendar day drops to avoid accidental reschedule. */
  onHoverChange?: (hovering: boolean) => void;
};

/**
 * Large fixed corner target for delete drops. Expanded padding = bigger hit area without extra visual clutter.
 */
export function ScheduleTrashDropZone({ active, isDuplicateDrag, onDropTrash, onHoverChange }: Props) {
  const [over, setOver] = useState(false);

  const setHover = (v: boolean) => {
    setOver(v);
    onHoverChange?.(v);
  };

  if (!active) return null;

  const accepts = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(SHIFT_DRAG_MIME) || e.dataTransfer.types.includes("text/plain");

  return (
    <div
      className="pointer-events-auto fixed bottom-4 right-4 z-[145] sm:bottom-8 sm:right-8"
      style={{ padding: "28px" }}
      onDragEnter={(e) => {
        if (accepts(e)) {
          e.preventDefault();
          setHover(true);
        }
      }}
      onDragOver={(e) => {
        if (accepts(e)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setHover(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setHover(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const p = readShiftDragPayload(e.dataTransfer);
        const id = p?.shiftId ?? e.dataTransfer.getData("text/plain");
        if (id) onDropTrash(id);
      }}
    >
      <div
        className={`flex min-h-[4.5rem] min-w-[13rem] select-none items-center justify-center gap-3 rounded-2xl border-2 px-6 py-4 shadow-lg transition-all duration-150 ${
          over
            ? "scale-110 border-red-500 bg-red-50 text-red-950 shadow-red-200/50 ring-4 ring-red-400/35"
            : "border-slate-200/90 bg-white/95 text-pulse-muted backdrop-blur-sm"
        }`}
      >
        <Trash2
          className={`h-6 w-6 shrink-0 transition-transform ${over ? "scale-110 text-red-600" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0 text-left">
          <p className={`text-sm font-bold ${over ? "text-red-800" : "text-pulse-navy"}`}>Drop to delete</p>
          {isDuplicateDrag ? (
            <p className="mt-0.5 text-[11px] font-medium text-amber-700">Release here to remove (not duplicate)</p>
          ) : (
            <p className="mt-0.5 text-[11px] text-pulse-muted">Release to remove shift</p>
          )}
        </div>
      </div>
    </div>
  );
}
