"use client";

import { Diamond } from "lucide-react";
import { motion } from "framer-motion";
import { roadmapCategoryMeta } from "@/lib/roadmap/categories";
import { dateToPercent, formatShortDate, parseIsoDate, type TimelineRange } from "@/lib/roadmap/timeline";
import type { RoadmapMilestone, RoadmapProjectListRow } from "@/lib/roadmap/types";
import { cn } from "@/lib/cn";

type Props = {
  milestones: RoadmapMilestone[];
  projects: RoadmapProjectListRow[];
  range: TimelineRange;
  onSelect: (m: RoadmapMilestone) => void;
};

export function RoadmapMilestonesRow({ milestones, projects, range, onSelect }: Props) {
  if (!milestones.length) return null;

  const projectById = new Map(projects.map((p) => [p.id, p]));

  return (
    <div className="border-t border-ds-border/60 bg-ds-secondary/30 px-4 py-3">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-ds-muted">Milestones</p>
      <div className="relative h-14">
        {milestones.map((m) => {
          const pct = dateToPercent(parseIsoDate(m.milestone_date), range);
          if (pct < 0 || pct > 100) return null;
          const proj = m.roadmap_project_id ? projectById.get(m.roadmap_project_id) : undefined;
          const color = proj ? (proj.color ?? roadmapCategoryMeta(proj.category).color) : "#6366f1";
          return (
            <button
              key={m.id}
              type="button"
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1 outline-none"
              style={{ left: `${pct}%` }}
              onClick={() => onSelect(m)}
            >
              <Diamond
                className={cn("h-4 w-4", m.completed ? "fill-current opacity-50" : "fill-current")}
                style={{ color }}
              />
              <span className="max-w-[88px] truncate text-[10px] font-medium text-ds-foreground">{m.title}</span>
              <span className="text-[9px] text-ds-muted">{formatShortDate(m.milestone_date)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RoadmapStatsFooter({
  stats,
}: {
  stats: { total: number; completed: number; in_progress: number; behind: number; upcoming_milestones: number } | null;
}) {
  const cards = [
    { label: "Projects", value: stats?.total ?? 0 },
    { label: "Completed", value: stats?.completed ?? 0 },
    { label: "In progress", value: stats?.in_progress ?? 0 },
    { label: "Behind", value: stats?.behind ?? 0, warn: (stats?.behind ?? 0) > 0 },
    { label: "Upcoming milestones", value: stats?.upcoming_milestones ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 border-t border-ds-border/60 bg-ds-bg px-4 py-4 sm:grid-cols-5">
      {cards.map((c) => (
        <motion.div
          key={c.label}
          layout
          className="rounded-xl border border-ds-border/60 bg-ds-secondary/40 px-4 py-3"
        >
          <p className="text-[10px] font-medium uppercase tracking-wide text-ds-muted">{c.label}</p>
          <p className={cn("mt-1 text-2xl font-semibold tabular-nums", c.warn && "text-red-500")}>{c.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
