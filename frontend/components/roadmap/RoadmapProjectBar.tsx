"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { roadmapCategoryMeta } from "@/lib/roadmap/categories";
import { barGeometry, parseIsoDate, shiftIsoDate, toIsoDate, type TimelineRange } from "@/lib/roadmap/timeline";
import type { RoadmapProjectListRow } from "@/lib/roadmap/types";
import { cn } from "@/lib/cn";

type DragMode = "move" | "resize-start" | "resize-end";

type Props = {
  project: RoadmapProjectListRow;
  range: TimelineRange;
  canEdit: boolean;
  selected: boolean;
  onSelect: () => void;
  onDatesChange: (id: string, start: string, end: string) => void;
};

export function RoadmapProjectBar({ project, range, canEdit, selected, onSelect, onDatesChange }: Props) {
  const geom = barGeometry(project.start_date, project.end_date, range);
  const cat = roadmapCategoryMeta(project.category);
  const color = project.color ?? cat.color;
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    mode: DragMode;
    startX: number;
    origStart: string;
    origEnd: string;
    width: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, mode: DragMode) => {
      if (!canEdit) return;
      e.stopPropagation();
      e.preventDefault();
      const track = barRef.current?.parentElement;
      if (!track) return;
      dragRef.current = {
        mode,
        startX: e.clientX,
        origStart: project.start_date,
        origEnd: project.end_date,
        width: track.getBoundingClientRect().width,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [canEdit, project.end_date, project.start_date],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !barRef.current?.parentElement) return;
      const dx = e.clientX - drag.startX;
      const dayMs = 86_400_000;
      const totalMs =
        parseIsoDate(toIsoDate(range.end)).getTime() -
        parseIsoDate(toIsoDate(range.start)).getTime() +
        dayMs;
      const daysDelta = Math.round((dx / drag.width) * (totalMs / dayMs));
      if (daysDelta === 0) return;

      let start = drag.origStart;
      let end = drag.origEnd;
      if (drag.mode === "move") {
        start = shiftIsoDate(drag.origStart, daysDelta);
        end = shiftIsoDate(drag.origEnd, daysDelta);
      } else if (drag.mode === "resize-start") {
        start = shiftIsoDate(drag.origStart, daysDelta);
        if (parseIsoDate(start) > parseIsoDate(end)) start = end;
      } else {
        end = shiftIsoDate(drag.origEnd, daysDelta);
        if (parseIsoDate(end) < parseIsoDate(start)) end = start;
      }
      onDatesChange(project.id, start, end);
    },
    [onDatesChange, project.id, range.end, range.start],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return (
    <motion.div
      ref={barRef}
      layout
      className={cn(
        "group absolute top-1/2 h-10 -translate-y-1/2 cursor-pointer rounded-xl shadow-sm transition-shadow",
        project.isPlaceholder && "border-2 border-dashed opacity-90",
        selected && "ring-2 ring-ds-primary ring-offset-1 ring-offset-ds-bg",
        canEdit && "cursor-grab active:cursor-grabbing",
      )}
      style={{ left: `${geom.left}%`, width: `${geom.width}%`, minWidth: 48 }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerDown={(e) => onPointerDown(e, "move")}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      title={`${project.title} · ${project.progress}%`}
    >
      <div
        className="relative h-full overflow-hidden rounded-xl border border-white/20"
        style={{ backgroundColor: `${color}22`, borderColor: `${color}55` }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-xl opacity-90"
          style={{ width: `${project.progress}%`, backgroundColor: color }}
        />
        {canEdit && (
          <>
            <div
              className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100"
              onPointerDown={(e) => onPointerDown(e, "resize-start")}
            />
            <div
              className="absolute right-0 top-0 z-10 h-full w-2 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100"
              onPointerDown={(e) => onPointerDown(e, "resize-end")}
            />
          </>
        )}
        <div className="relative z-[1] flex h-full items-center justify-between gap-2 px-3">
          <span className="truncate text-xs font-semibold text-ds-foreground">
            {project.title}
            {project.isPlaceholder ? (
              <span className="ml-1.5 text-[9px] font-normal uppercase tracking-wide text-ds-muted">placeholder</span>
            ) : null}
          </span>
          {!project.isPlaceholder && (
            <span className="shrink-0 text-[10px] font-medium text-ds-muted">{project.progress}%</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
