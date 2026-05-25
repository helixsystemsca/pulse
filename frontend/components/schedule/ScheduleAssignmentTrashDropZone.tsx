"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  assignedChipTrashAccepts,
  readAssignedChipDragPayload,
  type AssignedChipDragPayload,
} from "@/lib/schedule/routine-assignment-chip-drag";

type Props = {
  active: boolean;
  onDropChip: (payload: AssignedChipDragPayload) => void;
  onHoverChange?: (hovering: boolean) => void;
};

/** Fixed target for dragging assigned routine / badge chips off a worker row. */
export function ScheduleAssignmentTrashDropZone({ active, onDropChip, onHoverChange }: Props) {
  const [over, setOver] = useState(false);

  const setHover = (v: boolean) => {
    setOver(v);
    onHoverChange?.(v);
  };

  if (!active) return null;

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-4 z-[145] sm:bottom-8 sm:left-8"
      style={{ padding: "24px" }}
      onDragEnter={(e) => {
        if (assignedChipTrashAccepts(e)) {
          e.preventDefault();
          setHover(true);
        }
      }}
      onDragOver={(e) => {
        if (assignedChipTrashAccepts(e)) {
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
        const payload = readAssignedChipDragPayload(e.dataTransfer);
        if (payload) onDropChip(payload);
      }}
    >
      <div
        className={`flex min-h-[4.25rem] min-w-[12.5rem] select-none items-center justify-center gap-3 rounded-md border-2 px-5 py-3.5 shadow-lg transition-all duration-150 ${
          over
            ? "scale-105 border-red-500 bg-red-50 text-red-950 shadow-red-200/50 ring-4 ring-red-400/35"
            : "border-pulseShell-border bg-pulseShell-surface/95 text-gray-500 backdrop-blur-sm dark:text-slate-400"
        }`}
      >
        <Trash2
          className={`h-6 w-6 shrink-0 transition-transform ${over ? "scale-110 text-red-600" : "text-gray-400 dark:text-gray-500"}`}
          strokeWidth={2}
          aria-hidden
        />
        <div className="min-w-0 text-left">
          <p
            className={`text-sm font-bold ${over ? "text-red-800 dark:text-red-300" : "text-gray-900 dark:text-gray-100"}`}
          >
            Drop to remove
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">Unassign routine or badge</p>
        </div>
      </div>
    </div>
  );
}
