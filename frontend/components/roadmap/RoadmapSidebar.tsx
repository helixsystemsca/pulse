"use client";

import { ChevronDown, GripVertical, Pencil, Search, Trash2 } from "lucide-react";
import { RoadmapQuickAdd } from "@/components/roadmap/RoadmapQuickAdd";
import type { RoadmapStubItem } from "@/lib/projectsService";
import { roadmapCategoryMeta, ROADMAP_CATEGORIES, ROADMAP_PRIORITIES, ROADMAP_STATUSES } from "@/lib/roadmap/categories";
import { formatRange } from "@/lib/roadmap/timeline";
import { projectOverlapsRange } from "@/lib/roadmap/project-adapter";
import type { RoadmapFilters, RoadmapProjectListRow } from "@/lib/roadmap/types";
import { cn } from "@/lib/cn";

type Props = {
  year: number;
  projects: RoadmapProjectListRow[];
  rangeStart: string;
  rangeEnd: string;
  filters: RoadmapFilters;
  canEdit: boolean;
  selectedId: string | null;
  owners: string[];
  allTags: string[];
  onFiltersChange: (f: RoadmapFilters) => void;
  onCreateStubs: (items: RoadmapStubItem[]) => Promise<void>;
  onRefresh: () => void;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
};

export function RoadmapSidebar({
  year,
  projects,
  rangeStart,
  rangeEnd,
  filters,
  canEdit,
  selectedId,
  owners,
  allTags,
  onFiltersChange,
  onCreateStubs,
  onRefresh,
  onSelect,
  onEdit,
  onDelete,
}: Props) {
  function toggleCategory(id: (typeof ROADMAP_CATEGORIES)[number]["id"]) {
    const set = new Set(filters.categories);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onFiltersChange({ ...filters, categories: [...set] });
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-ds-border/60 bg-ds-secondary/20">
      <div className="space-y-3 border-b border-ds-border/60 p-4">
        <RoadmapQuickAdd
          year={year}
          canEdit={canEdit}
          onAdded={onRefresh}
          onCreateStubs={onCreateStubs}
        />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
          <input
            type="search"
            placeholder="Search…"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-full rounded-lg border border-ds-border bg-ds-bg py-2 pl-9 pr-3 text-sm outline-none ring-ds-primary focus:ring-1"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <details open className="mb-4">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-xs font-semibold uppercase tracking-wide text-ds-muted">
            <ChevronDown className="h-3 w-3" /> Categories
          </summary>
          <div className="mt-2 space-y-1">
            {ROADMAP_CATEGORIES.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.categories.length === 0 || filters.categories.includes(c.id)}
                  onChange={() => toggleCategory(c.id)}
                  className="rounded border-ds-border"
                />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.label}
              </label>
            ))}
          </div>
        </details>

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.showDependencies}
            onChange={(e) => onFiltersChange({ ...filters, showDependencies: e.target.checked })}
          />
          Show dependencies
        </label>

        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.showArchived}
            onChange={(e) => onFiltersChange({ ...filters, showArchived: e.target.checked })}
          />
          Archived
        </label>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ds-muted">
          All projects ({projects.length})
        </p>
        <ul className="space-y-1">
          {projects.map((p) => {
            const cat = roadmapCategoryMeta(p.category);
            const onTimeline = projectOverlapsRange(p.start_date, p.end_date, rangeStart, rangeEnd);
            return (
              <li key={p.id}>
                <div
                  className={cn(
                    "group flex items-start gap-2 rounded-lg px-2 py-2 transition",
                    selectedId === p.id ? "bg-ds-primary/10" : "hover:bg-ds-secondary/60",
                  )}
                >
                  <GripVertical className="mt-1 h-3 w-3 shrink-0 text-ds-muted/50" />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(p.id)}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? cat.color }} />
                      <span className="truncate text-sm font-medium">{p.title}</span>
                      {p.isPlaceholder && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                          Placeholder
                        </span>
                      )}
                      {!onTimeline && (
                        <span className="shrink-0 rounded bg-ds-secondary px-1.5 py-0.5 text-[9px] font-medium text-ds-muted">
                          Off timeline
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] text-ds-muted">{formatRange(p.start_date, p.end_date)}</p>
                    <div className="mt-1 h-1 overflow-hidden rounded-full bg-ds-border/40">
                      <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: cat.color }} />
                    </div>
                  </button>
                  {canEdit && (
                    <div className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100">
                      <button type="button" className="rounded p-1 hover:bg-ds-secondary" onClick={() => onEdit(p.id)} aria-label="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className="rounded p-1 text-red-500 hover:bg-red-500/10" onClick={() => onDelete(p.id)} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export { ROADMAP_PRIORITIES, ROADMAP_STATUSES };
