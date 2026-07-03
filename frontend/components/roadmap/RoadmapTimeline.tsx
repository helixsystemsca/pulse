"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { RoadmapProjectBar } from "@/components/roadmap/RoadmapProjectBar";
import { QUARTER_THEMES } from "@/lib/roadmap/categories";
import {
  barGeometry,
  buildTimelineColumns,
  todayPercent,
  type TimelineRange,
} from "@/lib/roadmap/timeline";
import type { RoadmapProjectListRow, RoadmapZoom } from "@/lib/roadmap/types";
import { cn } from "@/lib/cn";

type Props = {
  projects: RoadmapProjectListRow[];
  range: TimelineRange;
  zoom: RoadmapZoom;
  year: number;
  selectedId: string | null;
  canEdit: boolean;
  showDependencies: boolean;
  onSelectProject: (id: string) => void;
  onDatesChange: (id: string, start: string, end: string) => void;
};

export function RoadmapTimeline({
  projects,
  range,
  zoom,
  year,
  selectedId,
  canEdit,
  showDependencies,
  onSelectProject,
  onDatesChange,
}: Props) {
  const columns = useMemo(() => buildTimelineColumns(range, zoom), [range, zoom]);
  const todayPct = todayPercent(range);

  const quarterSpans = useMemo(() => {
    if (!columns.length) return [];
    const spans: { q: number; count: number }[] = [];
    let currentQ = columns[0]!.quarter;
    let count = 0;
    for (const col of columns) {
      if (col.quarter !== currentQ) {
        spans.push({ q: currentQ, count });
        currentQ = col.quarter;
        count = 0;
      }
      count++;
    }
    spans.push({ q: currentQ, count });
    return spans;
  }, [columns]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-ds-border/60 px-4 py-3 text-center">
        <h2 className="text-lg font-semibold tracking-tight text-ds-foreground">Roadmap {year}</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[720px] px-4 pb-4">
          {/* Quarter banners */}
          <div
            className="mt-4 grid gap-px overflow-hidden rounded-t-xl border border-ds-border/50"
            style={{ gridTemplateColumns: quarterSpans.map((s) => `${s.count}fr`).join(" ") }}
          >
            {quarterSpans.map(({ q, count }) => {
              const theme = QUARTER_THEMES[q - 1]!;
              return (
                <div
                  key={q}
                  className={cn("px-3 py-2 text-center", theme.tint)}
                  style={{ gridColumn: `span ${count}` }}
                >
                  <p className={cn("text-[10px] font-bold tracking-widest", theme.accent)}>Q{q}</p>
                  <p className="text-xs font-semibold text-ds-foreground">{theme.label}</p>
                  <p className="text-[10px] text-ds-muted">{theme.subtitle}</p>
                </div>
              );
            })}
          </div>

          {/* Month headers */}
          <div
            className="grid border-x border-ds-border/50 bg-ds-secondary/20"
            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
          >
            {columns.map((col) => (
              <div
                key={col.key}
                className="border-r border-ds-border/30 px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-ds-muted last:border-r-0"
              >
                {col.shortLabel}
              </div>
            ))}
          </div>

          {/* Project rows */}
          <div className="relative border border-t-0 border-ds-border/50">
            <AnimatePresence mode="popLayout">
              {projects.map((project, rowIndex) => (
                <motion.div
                  key={project.id}
                  layout
                  className={cn(
                    "relative border-b border-ds-border/30 last:border-b-0",
                    rowIndex % 2 === 0 ? "bg-ds-bg" : "bg-ds-secondary/10",
                  )}
                  style={{ height: 56 }}
                >
                  <div
                    className="pointer-events-none absolute inset-0 grid"
                    style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
                  >
                    {columns.map((col) => (
                      <div key={col.key} className="border-r border-ds-border/20 last:border-r-0" />
                    ))}
                  </div>
                  <div className="relative h-full px-1">
                    <RoadmapProjectBar
                      project={project}
                      range={range}
                      canEdit={canEdit}
                      selected={selectedId === project.id}
                      onSelect={() => onSelectProject(project.id)}
                      onDatesChange={onDatesChange}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {todayPct != null && (
              <div
                className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-500/80"
                style={{ left: `${todayPct}%` }}
              >
                <div className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-red-500" />
              </div>
            )}

            {showDependencies && (
              <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible">
                {projects.flatMap((p) =>
                  (p.dependencies ?? []).map((depId) => {
                    const dep = projects.find((x) => x.id === depId);
                    if (!dep) return null;
                    const from = barGeometry(dep.start_date, dep.end_date, range);
                    const to = barGeometry(p.start_date, p.end_date, range);
                    const y1 = (projects.indexOf(dep) + 0.5) * 56;
                    const y2 = (projects.indexOf(p) + 0.5) * 56;
                    const x1 = from.left + from.width;
                    const x2 = to.left;
                    return (
                      <line
                        key={`${depId}-${p.id}`}
                        x1={`${x1}%`}
                        y1={y1}
                        x2={`${x2}%`}
                        y2={y2}
                        stroke="currentColor"
                        strokeWidth={1}
                        className="text-ds-muted/40"
                        markerEnd="url(#roadmap-arrow)"
                      />
                    );
                  }),
                )}
                <defs>
                  <marker id="roadmap-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" className="fill-ds-muted/50" />
                  </marker>
                </defs>
              </svg>
            )}
          </div>

          {/* Row labels gutter — project names on left of bars handled in sidebar */}
          {!projects.length && (
            <div className="flex flex-col items-center justify-center gap-2 border border-t-0 border-ds-border/50 py-16 text-center text-sm text-ds-muted">
              <p>No projects in this period.</p>
              <p className="text-xs">Quick-add in the sidebar or create a project on the Projects page.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
