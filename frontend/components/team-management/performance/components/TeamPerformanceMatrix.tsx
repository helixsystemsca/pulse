"use client";

import type { DevelopmentQuadrant, WorkerDevelopmentSummary } from "@/lib/team-management/development-types";
import { QUADRANT_META } from "@/lib/team-management/development-types";
import { DevelopmentEmployeeChip } from "@/components/team-management/performance/components/DevelopmentEmployeeAvatar";
import { cn } from "@/lib/cn";

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
}: {
  quadrant: DevelopmentQuadrant;
  employees: WorkerDevelopmentSummary[];
  onSelect: (userId: string) => void;
}) {
  const meta = QUADRANT_META[quadrant];
  return (
    <div
      className={cn(
        "flex min-h-[10rem] flex-col rounded-xl border p-3 sm:min-h-[12rem] sm:p-4",
        meta.bgClass,
        meta.borderClass,
      )}
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
  lastUpdatedAt,
}: {
  items: WorkerDevelopmentSummary[];
  onSelectEmployee: (userId: string) => void;
  lastUpdatedAt?: string | null;
}) {
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
