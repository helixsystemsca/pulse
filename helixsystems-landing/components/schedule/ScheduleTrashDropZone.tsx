"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { readShiftDragPayload, SHIFT_DRAG_MIME } from "@/lib/schedule/drag";

type Props = {
  active: boolean;
  onDropTrash: (shiftId: string) => void;
};

/** Floating drop target while a shift is being dragged — drop to delete without a confirmation dialog. */
export function ScheduleTrashDropZone({ active, onDropTrash }: Props) {
  const [over, setOver] = useState(false);

  if (!active) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-24 left-1/2 z-[140] -translate-x-1/2 sm:bottom-28"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes(SHIFT_DRAG_MIME) || e.dataTransfer.types.includes("text/plain")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(SHIFT_DRAG_MIME) || e.dataTransfer.types.includes("text/plain")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const p = readShiftDragPayload(e.dataTransfer);
        const id = p?.shiftId ?? e.dataTransfer.getData("text/plain");
        if (id) onDropTrash(id);
      }}
    >
      <div
        className={`flex items-center gap-2 rounded-2xl border px-5 py-3 shadow-card transition-colors ${
          over
            ? "border-red-400 bg-red-50 text-red-900 ring-2 ring-red-300/60"
            : "border-slate-200/90 bg-white/95 text-pulse-muted backdrop-blur-sm"
        }`}
      >
        <Trash2 className={`h-5 w-5 shrink-0 ${over ? "text-red-600" : ""}`} strokeWidth={2} aria-hidden />
        <span className="text-sm font-semibold text-pulse-navy">Drop to delete</span>
      </div>
    </div>
  );
}
