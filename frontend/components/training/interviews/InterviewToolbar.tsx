"use client";

import { Search, Shuffle, Star, CheckCircle2 } from "lucide-react";
import type { InterviewCardFilters, InterviewStudyMode } from "@/lib/training/interviews/types";
import { cn } from "@/lib/cn";

const MODES: { id: InterviewStudyMode; label: string; hint: string }[] = [
  { id: "study", label: "Study", hint: "Flip cards and review full guidance" },
  { id: "random", label: "Random", hint: "Shuffled order each session" },
  { id: "mock", label: "Mock interview", hint: "Question only — reveal answers when ready" },
];

type Props = {
  mode: InterviewStudyMode;
  filters: InterviewCardFilters;
  categories: string[];
  difficulties: string[];
  shuffled: boolean;
  onModeChange: (mode: InterviewStudyMode) => void;
  onFiltersChange: (patch: Partial<InterviewCardFilters>) => void;
  onShuffleToggle: () => void;
};

export function InterviewToolbar({
  mode,
  filters,
  categories,
  difficulties,
  shuffled,
  onModeChange,
  onFiltersChange,
  onShuffleToggle,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-ds-border bg-ds-card p-3 sm:p-4">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            title={m.hint}
            onClick={() => onModeChange(m.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              mode === m.id
                ? "bg-ds-primary text-white"
                : "border border-ds-border text-ds-muted hover:bg-ds-muted/15 hover:text-ds-foreground",
            )}
          >
            {m.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onShuffleToggle}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
            shuffled
              ? "border-ds-primary bg-ds-primary/10 text-ds-primary"
              : "border-ds-border text-ds-muted hover:bg-ds-muted/15",
          )}
        >
          <Shuffle className="h-3.5 w-3.5" aria-hidden />
          Shuffle
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onFiltersChange({ search: e.target.value })}
          placeholder="Search questions, keywords, stories…"
          className="w-full rounded-lg border border-ds-border bg-ds-bg py-2 pl-9 pr-3 text-sm"
          aria-label="Search cards"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-lg border border-ds-border bg-ds-bg px-2 py-1.5 text-xs"
          value={filters.categories[0] ?? ""}
          onChange={(e) =>
            onFiltersChange({ categories: e.target.value ? [e.target.value] : [] })
          }
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-ds-border bg-ds-bg px-2 py-1.5 text-xs"
          value={filters.difficulties[0] ?? ""}
          onChange={(e) =>
            onFiltersChange({ difficulties: e.target.value ? [e.target.value] : [] })
          }
          aria-label="Filter by difficulty"
        >
          <option value="">All difficulties</option>
          {difficulties.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-ds-border px-2 py-1.5 text-xs">
          <input
            type="checkbox"
            checked={filters.favoritesOnly}
            onChange={(e) => onFiltersChange({ favoritesOnly: e.target.checked })}
          />
          <Star className="h-3.5 w-3.5" aria-hidden />
          Favorites
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-ds-border px-2 py-1.5 text-xs">
          <input
            type="checkbox"
            checked={filters.masteredOnly}
            onChange={(e) => onFiltersChange({ masteredOnly: e.target.checked })}
          />
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Mastered only
        </label>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-ds-border px-2 py-1.5 text-xs">
          <input
            type="checkbox"
            checked={filters.hideMastered}
            onChange={(e) => onFiltersChange({ hideMastered: e.target.checked })}
          />
          Hide mastered
        </label>
      </div>
    </div>
  );
}
