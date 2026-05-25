"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  assignedChipTrashAccepts,
  readAssignedChipDragPayload,
  type AssignedChipDragPayload,
} from "@/lib/schedule/routine-assignment-chip-drag";

type Props = {
  /** Chip removal drag is in progress — accept drops and highlight the target. */
  active: boolean;
  onDropChip: (payload: AssignedChipDragPayload) => void;
  onHoverChange?: (hovering: boolean) => void;
};

/** Inline header target for dragging assigned routine / badge chips off a worker row. */
export function ScheduleAssignmentTrashDropZone({ active, onDropChip, onHoverChange }: Props) {
  const [over, setOver] = useState(false);

  const setHover = (v: boolean) => {
    setOver(v);
    onHoverChange?.(v);
  };

  const emphasized = active && (over || active);

  return (
    <div
      className={cn(
        "flex min-h-[2.5rem] w-full max-w-[13.5rem] justify-self-center select-none items-center justify-center gap-2 rounded-lg border-2 border-dashed px-3 py-2 transition-all duration-150",
        emphasized || over
          ? "scale-[1.02] border-red-500 bg-red-50 text-red-950 shadow-sm ring-2 ring-red-400/30 dark:bg-red-950/40 dark:text-red-100"
          : active
            ? "border-red-300/80 bg-red-50/50 text-red-800/90 dark:border-red-500/40 dark:bg-red-950/25"
            : "border-ds-border/80 bg-ds-primary/30 text-ds-muted",
      )}
      onDragEnter={(e) => {
        if (!active || !assignedChipTrashAccepts(e)) return;
        e.preventDefault();
        setHover(true);
      }}
      onDragOver={(e) => {
        if (!active || !assignedChipTrashAccepts(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setHover(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setHover(false);
        }
      }}
      onDrop={(e) => {
        if (!active) return;
        e.preventDefault();
        setHover(false);
        const payload = readAssignedChipDragPayload(e.dataTransfer);
        if (payload) onDropChip(payload);
      }}
    >
      <Trash2
        className={cn(
          "h-5 w-5 shrink-0",
          emphasized || over ? "text-red-600" : active ? "text-red-500/80" : "text-ds-muted",
        )}
        strokeWidth={2}
        aria-hidden
      />
      <div className="min-w-0 text-left">
        <p
          className={cn(
            "text-xs font-bold leading-tight",
            emphasized || over ? "text-red-800 dark:text-red-200" : "text-ds-foreground",
          )}
        >
          {active ? (over ? "Release to remove" : "Drop to remove") : "Remove here"}
        </p>
        <p className="text-[10px] leading-tight text-ds-muted">
          {active ? "Unassign chip" : "Drag assigned chip"}
        </p>
      </div>
    </div>
  );
}
