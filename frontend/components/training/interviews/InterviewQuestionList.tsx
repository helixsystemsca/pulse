"use client";

import { CheckCircle2, Star } from "lucide-react";
import type { InterviewCard } from "@/lib/training/interviews/types";
import { cn } from "@/lib/cn";

type Props = {
  cards: InterviewCard[];
  activeId: number | null;
  favorites: number[];
  mastered: number[];
  onSelect: (cardId: number) => void;
};

export function InterviewQuestionList({ cards, activeId, favorites, mastered, onSelect }: Props) {
  const favSet = new Set(favorites);
  const masSet = new Set(mastered);

  return (
    <nav className="interview-question-list rounded-xl border border-ds-border bg-ds-card p-2" aria-label="All questions">
      <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ds-muted">
        All questions ({cards.length})
      </p>
      <ul className="space-y-0.5">
        {cards.map((c, i) => {
          const active = c.id === activeId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                className={cn(
                  "w-full rounded-lg px-2 py-2 text-left transition",
                  active ? "bg-ds-primary/10 ring-1 ring-ds-primary/30" : "hover:bg-ds-muted/15",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 text-[10px] font-bold tabular-nums",
                      active ? "text-ds-primary" : "text-ds-muted",
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-medium leading-snug", active && "text-ds-primary")}>
                      {c.question}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-ds-muted/20 px-1.5 py-0.5 text-[10px] text-ds-muted">
                        {c.category}
                      </span>
                      {favSet.has(c.id) ? (
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-label="Favorite" />
                      ) : null}
                      {masSet.has(c.id) ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" aria-label="Mastered" />
                      ) : null}
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
