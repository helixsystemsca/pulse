"use client";

import { useCallback, useEffect, useState } from "react";
import { Brain, Loader2, RotateCcw } from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  fetchStudyDue,
  postFlashcardReview,
  type TrainingReviewRating,
  type TrainingStudyDueCard,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription } from "@/styles/ui-classes";

const RATINGS: { id: TrainingReviewRating; label: string; className: string }[] = [
  { id: "again", label: "Again", className: "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-950 dark:text-red-200" },
  { id: "unsure", label: "Unsure", className: "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-200" },
  { id: "good", label: "Good", className: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-200" },
  { id: "easy", label: "Easy", className: "bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-200" },
];

export function FlashcardStudySession() {
  const [queue, setQueue] = useState<TrainingStudyDueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadDue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStudyDue(50);
      setQueue(res.cards);
      setIndex(0);
      setRevealed(false);
      setDone(res.cards.length === 0);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDue();
  }, [loadDue]);

  const current = queue[index];

  const submitRating = async (rating: TrainingReviewRating) => {
    if (!current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await postFlashcardReview(current.flashcard.id, rating);
      const next = index + 1;
      if (next >= queue.length) {
        setDone(true);
        setQueue([]);
      } else {
        setIndex(next);
        setRevealed(false);
      }
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ds-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading study queue…
      </div>
    );
  }

  if (done) {
    return (
      <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
        <Brain className="mx-auto h-10 w-10 text-teal-600 dark:text-teal-400" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-ds-foreground">You&apos;re caught up!</p>
        <p className={cn(uiPageDescription, "mx-auto mt-1 max-w-md")}>
          No flashcards are due right now. Check back later or complete lessons to unlock more cards.
        </p>
        <button
          type="button"
          onClick={() => void loadDue()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold hover:bg-ds-muted/30"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Refresh
        </button>
      </div>
    );
  }

  if (!current) {
    return <div className={uiCalloutWarning}>{error ?? "No cards available"}</div>;
  }

  const card = current.flashcard;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <p className="text-center text-xs font-medium text-ds-muted">
        Card {index + 1} of {queue.length}
      </p>

      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        className="w-full rounded-2xl border border-ds-border bg-ds-card p-8 text-left shadow-sm transition hover:border-teal-500/30 min-h-[200px] flex flex-col justify-center"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
          {revealed ? "Answer" : "Prompt"}
        </p>
        <p className="mt-3 text-lg font-medium text-ds-foreground">
          {revealed ? card.answer : card.prompt}
        </p>
        {revealed && card.explanation ? (
          <p className="mt-4 text-sm text-ds-muted">{card.explanation}</p>
        ) : null}
        {!revealed ? (
          <p className="mt-6 text-center text-xs text-ds-muted">Tap to reveal answer</p>
        ) : null}
      </button>

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled={submitting}
              onClick={() => void submitRating(r.id)}
              className={cn("rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50", r.className)}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
