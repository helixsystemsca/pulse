"use client";

import type { DragEvent } from "react";
import { useState } from "react";
import type { DevelopmentQuadrant, WorkerDevelopmentSummary } from "@/lib/team-management/development-types";
import { QUADRANT_META } from "@/lib/team-management/development-types";
import { DevelopmentEmployeeChip } from "@/components/team-management/performance/components/DevelopmentEmployeeAvatar";
import { cn } from "@/lib/cn";

const DRAG_USER_MIME = "application/x-pulse-development-user-id";

const MATRIX_GRID: { quadrant: DevelopmentQuadrant; gridArea: string }[] = [
  { quadrant: "C", gridArea: "top-left" },
  { quadrant: "A", gridArea: "top-right" },
  { quadrant: "D", gridArea: "bottom-left" },
  { quadrant: "B", gridArea: "bottom-right" },
];

function QuadrantCell({
  quadrant,
  employees,
  onSelect,
  onMoveEmployee,
  dragEnabled,
  draggingUserId,
  dropHighlight,
  onDropHighlight,
}: {
  quadrant: DevelopmentQuadrant;
  employees: WorkerDevelopmentSummary[];
  onSelect: (userId: string) => void;
  onMoveEmployee?: (userId: string, toQuadrant: DevelopmentQuadrant) => void;
  dragEnabled: boolean;
  draggingUserId: string | null;
  dropHighlight: DevelopmentQuadrant | null;
  onDropHighlight: (quadrant: DevelopmentQuadrant | null) => void;
}) {
  const meta = QUADRANT_META[quadrant];
  const isDropTarget = dropHighlight === quadrant;

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!dragEnabled || !onMoveEmployee) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    onDropHighlight(quadrant);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (!dragEnabled || !onMoveEmployee) return;
    e.preventDefault();
    onDropHighlight(null);
    const userId = e.dataTransfer.getData(DRAG_USER_MIME);
    if (!userId) return;
    const fromQuadrant = e.dataTransfer.getData("application/x-pulse-development-from-quadrant") as DevelopmentQuadrant;
    if (fromQuadrant === quadrant) return;
    onMoveEmployee(userId, quadrant);
  };

  return (
    <div
      className={cn(
        "flex min-h-[10rem] flex-col rounded-xl border p-3 transition-shadow sm:min-h-[12rem] sm:p-4",
        meta.bgClass,
        meta.borderClass,
        isDropTarget && "ring-2 ring-[var(--ds-accent)] ring-offset-2 ring-offset-ds-bg",
      )}
      onDragOver={onDragOver}
      onDragLeave={() => onDropHighlight(null)}
      onDrop={onDrop}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className={cn("text-xs font-bold", meta.textClass)}>
            {meta.shortLabel} – {meta.label}
          </p>
        </div>
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-bold tabular-nums text-ds-muted dark:bg-black/20">
          {employees.length}
        </span>
      </div>
      <div className="flex flex-1 flex-wrap content-start gap-2">
        {employees.map((emp) => (
          <DevelopmentEmployeeChip
            key={emp.user_id}
            avatarUrl={emp.avatar_url}
            fullName={emp.full_name}
            email={emp.email}
            jobTitle={emp.job_title}
            draggable={dragEnabled}
            isDragging={draggingUserId === emp.user_id}
            onDragStart={(e) => {
              if (!dragEnabled) {
                e.preventDefault();
                return;
              }
              setDraggingUserId(emp.user_id);
              e.dataTransfer.setData(DRAG_USER_MIME, emp.user_id);
              e.dataTransfer.setData("application/x-pulse-development-from-quadrant", emp.development_quadrant);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => setDraggingUserId(null)}
            onClick={() => onSelect(emp.user_id)}
          />
        ))}
      </div>
    </div>
  );
}

export function TeamPerformanceMatrix({
  items,
  onSelectEmployee,
  onMoveEmployee,
  lastUpdatedAt,
  moveDisabled = false,
}: {
  items: WorkerDevelopmentSummary[];
  onSelectEmployee: (userId: string) => void;
  onMoveEmployee?: (userId: string, toQuadrant: DevelopmentQuadrant) => void;
  lastUpdatedAt?: string | null;
  moveDisabled?: boolean;
}) {
  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);
  const [dropHighlight, setDropHighlight] = useState<DevelopmentQuadrant | null>(null);
  const dragEnabled = Boolean(onMoveEmployee) && !moveDisabled;

  const byQuadrant = (q: DevelopmentQuadrant) =>
    items.filter((i) => i.is_active && i.development_quadrant === q);

  const updatedLabel = lastUpdatedAt
    ? new Date(lastUpdatedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <section className="ops-dash-inner-card overflow-hidden p-4 sm:p-5" aria-label="Team performance matrix">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-ds-foreground">Team Performance Matrix</h2>
          {dragEnabled ? (
            <p className="mt-0.5 text-[11px] text-ds-muted">Drag employees between quadrants to update placement.</p>
          ) : null}
          {updatedLabel ? (
            <p className="mt-0.5 text-[11px] text-ds-muted">Last updated {updatedLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="relative">
        <div
          className="grid gap-2 sm:gap-3"
          style={{
            gridTemplateColumns: "auto 1fr 1fr",
            gridTemplateRows: "auto 1fr 1fr",
            gridTemplateAreas: `
              ". perf perf"
              "pot top-left top-right"
              "pot bottom-left bottom-right"
            `,
          }}
        >
          <div
            className="flex items-center justify-center px-1 text-[10px] font-bold uppercase tracking-wider text-ds-muted [grid-area:perf]"
            aria-hidden
          >
            Performance →
          </div>
          <div
            className="flex items-center justify-center py-2 text-[10px] font-bold uppercase tracking-wider text-ds-muted [grid-area:pot] [writing-mode:vertical-rl] rotate-180"
            aria-hidden
          >
            Potential →
          </div>
          {MATRIX_GRID.map(({ quadrant, gridArea }) => (
            <div key={quadrant} style={{ gridArea }}>
              <QuadrantCell
                quadrant={quadrant}
                employees={byQuadrant(quadrant)}
                onSelect={onSelectEmployee}
                onMoveEmployee={onMoveEmployee}
                dragEnabled={dragEnabled}
                draggingUserId={draggingUserId}
                dropHighlight={dropHighlight}
                onDropHighlight={setDropHighlight}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between px-8 text-[10px] font-semibold text-ds-muted sm:px-12">
          <span>Low</span>
          <span>High</span>
        </div>
        <p className="mt-1 text-center text-[10px] font-semibold text-ds-muted sm:hidden">Performance axis</p>
      </div>
    </section>
  );
}
