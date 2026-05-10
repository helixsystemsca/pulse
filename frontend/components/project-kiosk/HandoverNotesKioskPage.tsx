"use client";

import { AlertTriangle, CheckCircle2, FilePenLine } from "lucide-react";
import type { HandoverNoteCard } from "@/lib/project-kiosk/types";
import { cn } from "@/lib/cn";

function HandoverCard({ card }: { card: HandoverNoteCard }) {
  if (card.kind === "empty") {
    return (
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col ds-premium-panel rounded-xl p-4 sm:p-5",
          "opacity-[0.72]",
        )}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ds-muted">{card.ribbonLabel}</p>
        <p className="mt-3 font-headline text-lg font-bold text-ds-muted">{card.title}</p>
        <p className="mt-1 text-xs text-ds-muted">{card.metaLine}</p>
        <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-ds-muted">{card.body}</p>
      </div>
    );
  }

  const accent = card.accent === "danger" ? "border-t-rose-500" : "border-t-teal-600";
  const ribbonClass =
    card.accent === "danger" ? "text-rose-600 dark:text-rose-400" : "text-teal-700 dark:text-teal-300";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col ds-premium-panel rounded-xl border-t-4 p-4 sm:p-5",
        accent,
      )}
    >
      <p className={cn("text-[10px] font-bold uppercase tracking-[0.14em]", ribbonClass)}>{card.ribbonLabel}</p>
      <p className="mt-3 font-headline text-xl font-bold text-ds-foreground">{card.authorName}</p>
      <p className="mt-1 text-xs text-ds-muted">{card.metaLine}</p>
      <p className="mt-3 line-clamp-4 flex-1 text-sm leading-relaxed text-ds-foreground">{card.body}</p>
      {card.statusPill ? (
        <div
          className={cn(
            "mt-4 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold",
            card.statusPill.tone === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100",
          )}
        >
          {card.statusPill.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="min-w-0 leading-snug">{card.statusPill.label}</span>
        </div>
      ) : null}
    </div>
  );
}

export function HandoverNotesKioskPage({ cards }: { cards: HandoverNoteCard[] }) {
  const [a, b, c, d] = cards;
  const grid = [a, b, c, d].filter(Boolean) as HandoverNoteCard[];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-ds-secondary/35 px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-5">
      <div className="mx-auto flex w-full max-w-6xl shrink-0 items-start gap-2.5 sm:gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ds-border bg-ds-primary text-ds-accent shadow-sm sm:h-11 sm:w-11">
          <FilePenLine className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h2 className="font-headline text-xl font-bold tracking-tight text-ds-foreground sm:text-2xl md:text-3xl">
            Handover notes
          </h2>
          <p className="mt-0.5 text-xs text-ds-muted sm:text-sm">Shift-to-shift updates</p>
        </div>
      </div>

      <div className="mx-auto mt-4 grid min-h-0 w-full max-w-6xl flex-1 grid-cols-1 gap-3 overflow-hidden sm:mt-5 sm:grid-cols-2 sm:gap-4">
        {grid.map((card, i) => (
          <div key={`${card.kind}-${i}-${card.kind === "filled" ? card.authorName : card.title}`} className="flex min-h-0">
            <HandoverCard card={card} />
          </div>
        ))}
      </div>
    </div>
  );
}
