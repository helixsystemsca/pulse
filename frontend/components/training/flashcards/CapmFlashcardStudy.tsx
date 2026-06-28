"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { sectionTitleForFlashcard, buildLessonSectionTitleMap } from "@/lib/training/flashcard-section-lookup";
import {
  readFlashcardStudyPosition,
  resolveFlashcardStudyIndex,
  writeFlashcardStudyPosition,
} from "@/lib/training/flashcard-study-position";
import { TRAINING_ROUTES } from "@/lib/training/routes";
import {
  fetchCourseFlashcards,
  fetchTrainingCourse,
  postFlashcardReview,
  postTrainingProgress,
  type TrainingStudyDueCard,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageTitle } from "@/styles/ui-classes";
import "./flashcard-study.css";

const SWIPE_THRESHOLD_PX = 48;

type Props = { courseId: string };

function useFlipDurationMs(): number {
  const [ms, setMs] = useState(600);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setMs(mq.matches ? 48 : 600);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return ms;
}

export function CapmFlashcardStudy({ courseId }: Props) {
  const flipMs = useFlipDurationMs();
  const [courseTitle, setCourseTitle] = useState("");
  const [sectionLookup, setSectionLookup] = useState<Map<string, string>>(() => new Map());
  const [cards, setCards] = useState<TrainingStudyDueCard[]>([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = cards.length;
  const current = cards[index];
  const card = current?.flashcard;
  const cardNumber = total > 0 ? index + 1 : 0;
  const progressPct = total > 0 ? Math.round((cardNumber / total) * 100) : 0;
  const sectionName = sectionTitleForFlashcard(
    card?.lesson_id,
    sectionLookup,
    courseTitle || "Course",
  );
  const sessionComplete = reviewedCount >= total && total > 0;
  const interactionsLocked = animating || submitting || loading;

  const clearAnimTimer = useCallback(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
  }, []);

  const runWithAnimationLock = useCallback(
    (fn: () => void, durationMs: number = flipMs) => {
      clearAnimTimer();
      setAnimating(true);
      fn();
      animTimerRef.current = setTimeout(() => {
        setAnimating(false);
        animTimerRef.current = null;
      }, durationMs);
    },
    [clearAnimTimer, flipMs],
  );

  const applyIndex = useCallback(
    (next: number, deckCards?: TrainingStudyDueCard[]) => {
      const list = deckCards ?? cards;
      setIndex(next);
      const id = list[next]?.flashcard.id;
      if (id) {
        writeFlashcardStudyPosition(courseId, { flashcardId: id, index: next });
      }
    },
    [cards, courseId],
  );

  const goTo = useCallback(
    (next: number) => {
      if (interactionsLocked || next < 0 || next >= total || next === index) return;
      if (flipped) {
        runWithAnimationLock(() => setFlipped(false));
        window.setTimeout(() => applyIndex(next), flipMs);
      } else {
        applyIndex(next);
      }
    },
    [applyIndex, flipped, flipMs, index, interactionsLocked, runWithAnimationLock, total],
  );

  const toggleFlip = useCallback(() => {
    if (interactionsLocked || sessionComplete) return;
    runWithAnimationLock(() => setFlipped((f) => !f));
  }, [interactionsLocked, runWithAnimationLock, sessionComplete]);

  const loadDeck = useCallback(
    async (opts?: { resetSession?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        const [deck, course] = await Promise.all([
          fetchCourseFlashcards(courseId),
          fetchTrainingCourse(courseId),
        ]);
        setCourseTitle(deck.course_title);
        setSectionLookup(buildLessonSectionTitleMap(course));
        setCards(deck.cards);
        const cardIds = deck.cards.map((c) => c.flashcard.id);
        const saved = opts?.resetSession ? null : readFlashcardStudyPosition(courseId);
        const startIndex = opts?.resetSession
          ? 0
          : resolveFlashcardStudyIndex(cardIds, saved);
        setIndex(startIndex);
        setFlipped(false);
        setReviewedCount(0);
        if (deck.total > 0 && startIndex >= 0) {
          applyIndex(startIndex, deck.cards);
          await postTrainingProgress({
            scope_kind: "course",
            scope_id: courseId,
            status: "in_progress",
            progress_pct: Math.round(((startIndex + 1) / deck.total) * 100),
          });
        }
      } catch (e) {
        setError(parseClientApiError(e).message);
      } finally {
        setLoading(false);
      }
    },
    [applyIndex, courseId],
  );

  useEffect(() => {
    void loadDeck();
    return () => clearAnimTimer();
  }, [loadDeck, clearAnimTimer]);

  const persistCourseProgress = async (nextReviewed: number) => {
    if (total === 0) return;
    const pct = Math.min(100, Math.round((nextReviewed / total) * 100));
    await postTrainingProgress({
      scope_kind: "course",
      scope_id: courseId,
      status: pct >= 100 ? "completed" : "in_progress",
      progress_pct: pct,
    });
  };

  const rateCard = useCallback(
    async (rating: "again" | "good") => {
      if (!card || interactionsLocked || !flipped) return;
      setSubmitting(true);
      setError(null);
      try {
        await postFlashcardReview(card.id, rating);
        const nextReviewed = reviewedCount + 1;
        setReviewedCount(nextReviewed);
        await persistCourseProgress(nextReviewed);

        const nextIndex = index + 1;
        runWithAnimationLock(() => setFlipped(false));
        window.setTimeout(() => {
          if (nextIndex < total) {
            applyIndex(nextIndex);
          }
        }, flipMs);
      } catch (e) {
        setError(parseClientApiError(e).message);
      } finally {
        setSubmitting(false);
      }
    },
    [applyIndex, card, flipped, flipMs, index, interactionsLocked, reviewedCount, runWithAnimationLock, total],
  );

  useEffect(() => {
    if (sessionComplete || loading) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (interactionsLocked) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;

      if (e.code === "Space") {
        e.preventDefault();
        toggleFlip();
        return;
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        goTo(index - 1);
        return;
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        goTo(index + 1);
        return;
      }
      if (e.key === "1" && flipped) {
        e.preventDefault();
        void rateCard("again");
        return;
      }
      if (e.key === "2" && flipped) {
        e.preventDefault();
        void rateCard("good");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flipped, goTo, index, interactionsLocked, loading, rateCard, sessionComplete, toggleFlip]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (interactionsLocked || sessionComplete) return;
    const t = e.changedTouches[0];
    if (!t) return;
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (interactionsLocked || sessionComplete) return;
    const startX = touchStartX.current;
    const startY = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (startX == null || startY == null) return;

    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) goTo(index + 1);
    else goTo(index - 1);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ds-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading flashcards…
      </div>
    );
  }

  if (error && !card) {
    return (
      <div className="space-y-3">
        <div className={uiCalloutWarning}>{error}</div>
        <Link href={TRAINING_ROUTES.flashcards} className="text-sm font-semibold text-teal-700 hover:underline">
          ← Back to courses
        </Link>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-ds-muted">This course has no flashcards yet.</p>
        <Link
          href={TRAINING_ROUTES.flashcards}
          className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Choose another course
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-3">
        <Link
          href={TRAINING_ROUTES.flashcards}
          className="inline-flex items-center gap-1 text-sm font-medium text-ds-muted hover:text-ds-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Courses
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
              {sectionName}
            </p>
            <h2 className={cn(uiPageTitle, "mt-0.5 truncate")}>{courseTitle}</h2>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-ds-muted">Card</p>
            <p className="text-lg font-bold tabular-nums text-ds-foreground">
              {cardNumber}
              <span className="text-sm font-semibold text-ds-muted"> / {total}</span>
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-ds-muted">
            <span>Progress</span>
            <span className="tabular-nums font-medium">{progressPct}%</span>
          </div>
          <div
            className="flashcard-progress-track"
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Study progress: card ${cardNumber} of ${total}`}
          >
            <div className="flashcard-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {sessionComplete ? (
        <div className="rounded-xl border border-ds-border bg-ds-card p-8 text-center">
          <p className="text-lg font-semibold text-ds-foreground">Session complete</p>
          <p className="mt-2 text-sm text-ds-muted">You reviewed all {total} cards. Progress has been saved.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void loadDeck({ resetSession: true })}
              className="inline-flex items-center gap-2 rounded-lg border border-ds-border px-4 py-2 text-sm font-semibold hover:bg-ds-muted/30"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              Study again
            </button>
            <Link
              href={TRAINING_ROUTES.flashcards}
              className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Back to courses
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div
            className="flashcard-scene"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <button
              type="button"
              onClick={toggleFlip}
              disabled={interactionsLocked}
              className="block w-full border-0 bg-transparent p-0 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/50 rounded-2xl disabled:cursor-not-allowed"
              aria-pressed={flipped}
              aria-label={flipped ? "Show question (Space)" : "Show answer (Space)"}
            >
              <div
                className={cn("flashcard-inner", flipped && "is-flipped", animating && "is-animating")}
                style={{ minHeight: 300 }}
              >
                <div className="flashcard-face">
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    Question
                  </p>
                  <p className="mt-4 text-xl font-medium leading-relaxed text-ds-foreground">{card?.prompt}</p>
                  <p className="mt-8 text-center text-xs text-ds-muted">
                    Tap or press <kbd className="rounded border border-ds-border px-1.5 py-0.5 font-mono text-[10px]">Space</kbd> to flip
                  </p>
                </div>
                <div className="flashcard-face flashcard-face-back">
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">Answer</p>
                  <p className="mt-4 text-xl font-medium leading-relaxed text-ds-foreground">{card?.answer}</p>
                  {card?.explanation ? (
                    <p className="mt-4 rounded-lg bg-ds-muted/15 px-3 py-2 text-sm text-ds-muted">{card.explanation}</p>
                  ) : null}
                </div>
              </div>
            </button>
          </div>

          {error ? <div className={uiCalloutWarning}>{error}</div> : null}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => goTo(index - 1)}
              disabled={index === 0 || interactionsLocked}
              className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-ds-muted/20"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Previous
            </button>
            <p className="hidden text-center text-[11px] text-ds-muted sm:block">
              ← → navigate · Space flip · 1 Again · 2 Got it
            </p>
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index >= total - 1 || interactionsLocked}
              className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 hover:bg-ds-muted/20"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {flipped ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={interactionsLocked}
                onClick={() => void rateCard("again")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
              >
                <ThumbsDown className="h-4 w-4" aria-hidden />
                Again
                <kbd className="ml-1 hidden rounded border border-red-300/60 px-1 py-0.5 font-mono text-[10px] sm:inline">1</kbd>
              </button>
              <button
                type="button"
                disabled={interactionsLocked}
                onClick={() => void rateCard("good")}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                <ThumbsUp className="h-4 w-4" aria-hidden />
                Got it
                <kbd className="ml-1 hidden rounded border border-emerald-300/60 px-1 py-0.5 font-mono text-[10px] sm:inline">2</kbd>
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-ds-muted sm:hidden">Swipe left or right to change cards</p>
          )}
        </>
      )}
    </div>
  );
}
