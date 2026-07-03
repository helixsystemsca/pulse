"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Briefcase, ChevronRight, Loader2, MessageSquare } from "lucide-react";
import { listInterviewDecks } from "@/lib/training/interviews/loader";
import { readInterviewDeckProgress } from "@/lib/training/interviews/progress";
import { TRAINING_ROUTES, trainingInterviewStudyHref } from "@/lib/training/routes";
import type { InterviewDeckSummary } from "@/lib/training/interviews/types";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription, uiPageStack, uiPageTitle } from "@/styles/ui-classes";

export function InterviewDeckPicker() {
  const [decks, setDecks] = useState<InterviewDeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const rows = await listInterviewDecks();
        if (!cancelled) setDecks(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load interview decks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={uiPageStack}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={uiPageTitle}>Interview Prep</h2>
            <p className={cn(uiPageDescription, "max-w-2xl")}>
              JSON-driven interview decks for real job preparation. Quick-add decks by dropping files in{" "}
              <code className="text-xs">public/training/interviews/</code> — no code changes required.
            </p>
          </div>
          <Link
            href={TRAINING_ROUTES.flashcards}
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold hover:bg-ds-muted/20"
          >
            Certification flashcards
          </Link>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Discovering interview decks…
        </div>
      ) : null}

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      {!loading && !error && decks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
          <MessageSquare className="mx-auto h-10 w-10 text-ds-muted" aria-hidden />
          <p className="mt-3 text-sm font-medium text-ds-foreground">No interview decks found</p>
          <p className="mt-1 text-sm text-ds-muted">
            Add a <code className="text-xs">.json</code> file under{" "}
            <code className="text-xs">public/training/interviews/</code> and refresh.
          </p>
        </div>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((deck) => {
          const progress = mounted ? readInterviewDeckProgress(deck.id) : { favorites: [], mastered: [] };
          const pct = deck.cardCount
            ? Math.round((progress.mastered.length / deck.cardCount) * 100)
            : 0;
          return (
            <li key={deck.id}>
              <Link
                href={trainingInterviewStudyHref(deck.id)}
                className="group flex h-full flex-col rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm transition hover:border-ds-primary/40 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ds-primary/10 text-ds-primary">
                    <Briefcase className="h-5 w-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-ds-foreground group-hover:text-ds-primary">{deck.title}</h3>
                    <p className="text-xs text-ds-muted">{deck.organization}</p>
                    <p className="text-xs text-ds-muted">{deck.position}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-ds-muted group-hover:text-ds-primary" />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-ds-muted">{deck.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ds-muted">
                  <span>{deck.cardCount} cards</span>
                  <span aria-hidden>·</span>
                  <span>{progress.mastered.length} mastered ({pct}%)</span>
                  {progress.favorites.length ? (
                    <>
                      <span aria-hidden>·</span>
                      <span>{progress.favorites.length} favorites</span>
                    </>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
