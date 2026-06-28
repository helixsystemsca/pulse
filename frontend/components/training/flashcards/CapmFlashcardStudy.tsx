"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { sectionTitleForFlashcard, buildLessonSectionTitleMap } from "@/lib/training/flashcard-section-lookup";
import {
  filterCardsForSection,
  findSectionById,
} from "@/lib/training/flashcard-sections";
import {
  applyFlashcardStudySettings,
  flashcardFaceContent,
} from "@/lib/training/flashcard-deck-filter";
import {
  readFlashcardStudyPosition,
  resolveFlashcardStudyIndex,
  writeFlashcardStudyPosition,
} from "@/lib/training/flashcard-study-position";
import { recordFlashcardStudySession } from "@/lib/training/flashcard-study-sessions";
import { useFlashcardStudySettings } from "@/lib/training/flashcard-study-settings";
import {
  computeStudySessionStats,
  mergeReviewAfterRating,
} from "@/lib/training/flashcard-session-stats";
import { trainingFlashcardCourseHref } from "@/lib/training/routes";
import {
  fetchCourseFlashcards,
  fetchTrainingCourse,
  postFlashcardReview,
  type TrainingReviewRating,
  type TrainingStudyDueCard,
} from "@/lib/training/trainingPlatformApi";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageTitle } from "@/styles/ui-classes";
import { FlashcardStudySettingsPanel } from "@/components/training/flashcards/FlashcardStudySettingsPanel";
import { FlashcardStudyStatsBar } from "@/components/training/flashcards/FlashcardStudyStatsBar";
import "./flashcard-study.css";

const SWIPE_THRESHOLD_PX = 48;

const CONFIDENCE_RATINGS: {
  id: TrainingReviewRating;
  label: string;
  shortcut: string;
  className: string;
}[] = [
  { id: "again", label: "Again", shortcut: "1", className: "flashcard-rating-btn--again" },
  { id: "good", label: "Good", shortcut: "2", className: "flashcard-rating-btn--good" },
  { id: "easy", label: "Easy", shortcut: "3", className: "flashcard-rating-btn--easy" },
];

type Props = { courseId: string; sectionId: string };

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

export function CapmFlashcardStudy({ courseId, sectionId }: Props) {
  const flipMs = useFlipDurationMs();
  const { settings, setSettings } = useFlashcardStudySettings();
  const [courseTitle, setCourseTitle] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionLookup, setSectionLookup] = useState<Map<string, string>>(() => new Map());
  const [cards, setCards] = useState<TrainingStudyDueCard[]>([]);
  const [sectionCardTotal, setSectionCardTotal] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionRatings, setSessionRatings] = useState<TrainingReviewRating[]>([]);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardsRef = useRef<TrainingStudyDueCard[]>([]);
  const sessionStartRef = useRef<number | null>(null);
  const sessionRecordedRef = useRef(false);
  const cardsReviewedRef = useRef(0);

  const total = cards.length;
  const current = cards[index];
  const card = current?.flashcard;
  cardsRef.current = cards;
  const faces = card ? flashcardFaceContent(card, settings) : null;
  const cardNumber = total > 0 ? index + 1 : 0;
  const progressPct = total > 0 ? Math.round((cardNumber / total) * 100) : 0;
  const sectionName = sectionTitle || sectionTitleForFlashcard(
    card?.lesson_id,
    sectionLookup,
    courseTitle || "Course",
  );
  const sessionComplete = reviewedCount >= total && total > 0;
  const interactionsLocked = animating || submitting || loading;
  const sessionStats = computeStudySessionStats(cards, reviewedCount, sessionRatings);

  const recordStudySession = useCallback(() => {
    if (sessionRecordedRef.current || sessionStartRef.current == null) return;
    const cardsReviewed = cardsReviewedRef.current;
    if (cardsReviewed <= 0) return;
    sessionRecordedRef.current = true;
    const endedAt = Date.now();
    recordFlashcardStudySession({
      courseId,
      sectionId,
      startedAt: new Date(sessionStartRef.current).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      cardsReviewed,
      durationSeconds: Math.max(1, Math.round((endedAt - sessionStartRef.current) / 1000)),
    });
  }, [courseId, sectionId]);

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
      const list = deckCards ?? cardsRef.current;
      setIndex(next);
      const id = list[next]?.flashcard.id;
      if (id && settings.resumePreviousSession) {
        writeFlashcardStudyPosition(courseId, { flashcardId: id, index: next }, sectionId);
      }
    },
    [courseId, sectionId, settings.resumePreviousSession],
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
        const section = findSectionById(course, sectionId);
        if (!section) {
          throw new Error("Section not found for this course.");
        }
        const sectionCards = filterCardsForSection(deck.cards, section);
        const filteredCards = applyFlashcardStudySettings(sectionCards, settings);
        setCourseTitle(deck.course_title);
        setSectionTitle(section.title);
        setSectionLookup(buildLessonSectionTitleMap(course));
        setSectionCardTotal(sectionCards.length);
        setCards(filteredCards);
        const cardIds = filteredCards.map((c) => c.flashcard.id);
        const saved =
          opts?.resetSession || !settings.resumePreviousSession
            ? null
            : readFlashcardStudyPosition(courseId, sectionId);
        const startIndex = opts?.resetSession
          ? 0
          : resolveFlashcardStudyIndex(cardIds, saved);
        setIndex(startIndex);
        setFlipped(false);
        setReviewedCount(0);
        setSessionRatings([]);
        sessionStartRef.current = Date.now();
        sessionRecordedRef.current = false;
        cardsReviewedRef.current = 0;
        if (filteredCards.length > 0 && startIndex >= 0 && settings.resumePreviousSession) {
          const id = filteredCards[startIndex]?.flashcard.id;
          if (id) {
            writeFlashcardStudyPosition(
              courseId,
              { flashcardId: id, index: startIndex },
              sectionId,
            );
          }
        }
      } catch (e) {
        setError(parseClientApiError(e).message);
      } finally {
        setLoading(false);
      }
    },
    [courseId, sectionId, settings],
  );

  useEffect(() => {
    void loadDeck();
    return () => {
      clearAnimTimer();
      recordStudySession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when route or study filters change
  }, [
    courseId,
    sectionId,
    settings.shuffleCards,
    settings.hideMasteredCards,
    settings.studyNewCardsOnly,
    settings.studyIncorrectCardsOnly,
    settings.reverseQuestionAnswer,
    settings.resumePreviousSession,
  ]);

  useEffect(() => {
    if (sessionComplete) {
      recordStudySession();
    }
  }, [sessionComplete, recordStudySession]);

  const rateCard = useCallback(
    async (rating: TrainingReviewRating) => {
      if (!card || interactionsLocked || !flipped) return;
      if (rating !== "again" && rating !== "good" && rating !== "easy") return;
      setSubmitting(true);
      setError(null);
      try {
        const response = await postFlashcardReview(card.id, rating);
        setCards((prev) =>
          prev.map((item, i) =>
            i === index ? mergeReviewAfterRating(item, rating, response) : item,
          ),
        );
        setSessionRatings((prev) => [...prev, rating]);
        const nextReviewed = reviewedCount + 1;
        setReviewedCount(nextReviewed);
        cardsReviewedRef.current = nextReviewed;

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
        return;
      }
      if (e.key === "3" && flipped) {
        e.preventDefault();
        void rateCard("easy");
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

  if (loading && cards.length === 0) {
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
        <Link href={trainingFlashcardCourseHref(courseId)} className="text-sm font-semibold text-teal-700 hover:underline">
          ← Back to sections
        </Link>
      </div>
    );
  }

  if (total === 0) {
    const filteredEmpty = sectionCardTotal > 0;
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <FlashcardStudySettingsPanel settings={settings} onChange={setSettings} />
        <div className="space-y-4 text-center">
          <p className="text-sm text-ds-muted">
            {filteredEmpty
              ? "No cards match your study settings. Try changing settings above."
              : "This section has no flashcards yet."}
          </p>
          <Link
            href={trainingFlashcardCourseHref(courseId)}
            className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to sections
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-3">
        <Link
          href={trainingFlashcardCourseHref(courseId)}
          className="inline-flex items-center gap-1 text-sm font-medium text-ds-muted hover:text-ds-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Sections
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
              {courseTitle}
            </p>
            <h2 className={cn(uiPageTitle, "mt-0.5 truncate")}>{sectionName}</h2>
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

        <FlashcardStudyStatsBar stats={sessionStats} />
      </div>

      <FlashcardStudySettingsPanel settings={settings} onChange={setSettings} />

      {sessionComplete ? (
        <div className="rounded-xl border border-ds-border bg-ds-card p-8 text-center">
          <p className="text-lg font-semibold text-ds-foreground">Session complete</p>
          <p className="mt-2 text-sm text-ds-muted">You reviewed all {total} cards. Progress has been saved.</p>
          <div className="mt-6">
            <FlashcardStudyStatsBar stats={sessionStats} />
          </div>
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
              href={trainingFlashcardCourseHref(courseId)}
              className="inline-flex items-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Back to sections
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
                    {faces?.frontLabel}
                  </p>
                  <p className="mt-4 text-xl font-medium leading-relaxed text-ds-foreground">{faces?.frontText}</p>
                  <p className="mt-8 text-center text-xs text-ds-muted">
                    Tap or press <kbd className="rounded border border-ds-border px-1.5 py-0.5 font-mono text-[10px]">Space</kbd> to flip
                  </p>
                </div>
                <div className="flashcard-face flashcard-face-back">
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
                    {faces?.backLabel}
                  </p>
                  <p className="mt-4 text-xl font-medium leading-relaxed text-ds-foreground">{faces?.backText}</p>
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
              ← → navigate · Space flip · 1 Again · 2 Good · 3 Easy
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
            <div className="space-y-2">
              <p className="text-center text-xs font-medium text-ds-muted">How confident are you?</p>
              <div className="flashcard-rating-row">
                {CONFIDENCE_RATINGS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={interactionsLocked}
                    onClick={() => void rateCard(opt.id)}
                    className={cn("flashcard-rating-btn", opt.className)}
                  >
                    <span>{opt.label}</span>
                    <kbd className="hidden rounded border border-current/25 px-1 py-0.5 font-mono text-[10px] opacity-70 sm:inline">
                      {opt.shortcut}
                    </kbd>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-xs text-ds-muted sm:hidden">Swipe left or right to change cards</p>
          )}
        </>
      )}
    </div>
  );
}
