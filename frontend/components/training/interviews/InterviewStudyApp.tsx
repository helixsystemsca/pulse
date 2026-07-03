"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
  Timer,
} from "lucide-react";
import { InterviewCardView } from "@/components/training/interviews/InterviewCardView";
import { InterviewToolbar } from "@/components/training/interviews/InterviewToolbar";
import {
  filterInterviewCards,
  interviewProgressStats,
  shuffleInterviewCards,
  uniqueInterviewCategories,
  uniqueInterviewDifficulties,
} from "@/lib/training/interviews/filters";
import { loadInterviewDeckById } from "@/lib/training/interviews/loader";
import {
  readInterviewDeckProgress,
  saveInterviewStudyIndex,
  toggleInterviewFavorite,
  toggleInterviewMastered,
} from "@/lib/training/interviews/progress";
import { TRAINING_ROUTES } from "@/lib/training/routes";
import type {
  InterviewCard,
  InterviewCardFilters,
  InterviewDeckDocument,
  InterviewDeckProgress,
  InterviewStudyMode,
} from "@/lib/training/interviews/types";
import { cn } from "@/lib/cn";
import { uiCalloutWarning } from "@/styles/ui-classes";
import "./interview-study.css";

const DEFAULT_FILTERS: InterviewCardFilters = {
  search: "",
  categories: [],
  difficulties: [],
  favoritesOnly: false,
  masteredOnly: false,
  hideMastered: false,
};

type Props = { deckId: string };

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function InterviewStudyApp({ deckId }: Props) {
  const [document, setDocument] = useState<InterviewDeckDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<InterviewStudyMode>("study");
  const [filters, setFilters] = useState<InterviewCardFilters>(DEFAULT_FILTERS);
  const [shuffled, setShuffled] = useState(false);
  const [progress, setProgress] = useState<InterviewDeckProgress>(() => readInterviewDeckProgress(deckId));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mockRevealed, setMockRevealed] = useState(false);
  const [mockSeconds, setMockSeconds] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { document: doc } = await loadInterviewDeckById(deckId);
        if (cancelled) return;
        setDocument(doc);
        const saved = readInterviewDeckProgress(deckId);
        setProgress(saved);
        setIndex(Math.min(saved.lastIndex, Math.max(0, doc.cards.length - 1)));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load deck.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deckId]);

  const baseCards = document?.cards ?? [];

  const filteredCards = useMemo(
    () => filterInterviewCards(baseCards, filters, progress),
    [baseCards, filters, progress],
  );

  const studyCards = useMemo(() => {
    let cards = [...filteredCards];
    if (mode === "random" || shuffled) {
      cards = shuffleInterviewCards(cards);
    }
    return cards;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle when seed or mode changes
  }, [filteredCards, mode, shuffled, shuffleSeed]);

  const card: InterviewCard | undefined = studyCards[index];
  const stats = interviewProgressStats(baseCards, progress);
  const categories = useMemo(() => uniqueInterviewCategories(baseCards), [baseCards]);
  const difficulties = useMemo(() => uniqueInterviewDifficulties(baseCards), [baseCards]);

  const resetCardState = useCallback(() => {
    setFlipped(false);
    setMockRevealed(false);
    setMockSeconds(0);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      if (!studyCards.length) return;
      const clamped = Math.max(0, Math.min(studyCards.length - 1, next));
      setIndex(clamped);
      resetCardState();
      setProgress(saveInterviewStudyIndex(deckId, clamped));
    },
    [deckId, resetCardState, studyCards.length],
  );

  useEffect(() => {
    if (index >= studyCards.length && studyCards.length > 0) {
      goTo(studyCards.length - 1);
    }
  }, [goTo, index, studyCards.length]);

  useEffect(() => {
    if (mode !== "mock" || mockRevealed || !card) return;
    const t = window.setInterval(() => setMockSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [card, mockRevealed, mode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!card) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (mode === "mock") {
          if (!mockRevealed) setMockRevealed(true);
          else setFlipped((f) => !f);
        } else {
          setFlipped((f) => !f);
        }
      } else if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setProgress(toggleInterviewFavorite(deckId, card.id));
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setProgress(toggleInterviewMastered(deckId, card.id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, deckId, goTo, index, mockRevealed, mode]);

  const isFavorite = card ? progress.favorites.includes(card.id) : false;
  const isMastered = card ? progress.mastered.includes(card.id) : false;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-ds-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading interview deck…
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="space-y-3">
        <div className={uiCalloutWarning}>{error ?? "Deck not found."}</div>
        <Link href={TRAINING_ROUTES.interviews} className="text-sm font-medium text-ds-primary hover:underline">
          ← All interview decks
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={TRAINING_ROUTES.interviews}
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ds-muted hover:text-ds-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All decks
          </Link>
          <h2 className="text-xl font-semibold text-ds-foreground">{document.deck.title}</h2>
          <p className="text-sm text-ds-muted">
            {document.deck.organization} · {document.deck.position}
          </p>
        </div>
        <div className="text-right text-xs text-ds-muted">
          <p>
            {stats.mastered}/{stats.total} mastered · {stats.favorites} favorites
          </p>
          <p className="mt-0.5">Shortcuts: ← → navigate · Space flip/reveal · F favorite · M mastered</p>
        </div>
      </header>

      <InterviewToolbar
        mode={mode}
        filters={filters}
        categories={categories}
        difficulties={difficulties}
        shuffled={shuffled}
        onModeChange={(m) => {
          setMode(m);
          resetCardState();
          if (m === "random") setShuffleSeed((s) => s + 1);
        }}
        onFiltersChange={(patch) => {
          setFilters((f) => ({ ...f, ...patch }));
          goTo(0);
        }}
        onShuffleToggle={() => {
          setShuffled((s) => !s);
          setShuffleSeed((n) => n + 1);
          goTo(0);
        }}
      />

      {studyCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ds-border p-8 text-center text-sm text-ds-muted">
          No cards match your filters.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 text-sm text-ds-muted">
            <span>
              Card {index + 1} of {studyCards.length}
            </span>
            {mode === "mock" ? (
              <span className="interview-mock-timer inline-flex items-center gap-1.5 font-semibold text-ds-foreground">
                <Timer className="h-4 w-4" aria-hidden />
                {formatElapsed(mockSeconds)}
              </span>
            ) : null}
          </div>

          <button
            type="button"
            className="w-full text-left"
            onClick={() => {
              if (mode === "mock" && !mockRevealed) return;
              setFlipped((f) => !f);
            }}
            aria-label="Flip card"
          >
            {card ? (
              <InterviewCardView
                card={card}
                revealed={mockRevealed}
                mockMode={mode === "mock"}
                flipped={flipped}
              />
            ) : null}
          </button>

          {mode === "mock" && !mockRevealed ? (
            <button
              type="button"
              className="w-full rounded-xl bg-ds-primary px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
              onClick={() => setMockRevealed(true)}
            >
              Reveal answer
            </button>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={index <= 0}
                onClick={() => goTo(index - 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-sm font-medium disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                disabled={index >= studyCards.length - 1}
                onClick={() => goTo(index + 1)}
                className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-sm font-medium disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            {card ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setProgress(toggleInterviewFavorite(deckId, card.id))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium",
                    isFavorite
                      ? "border-amber-400 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      : "border-ds-border",
                  )}
                >
                  <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
                  Favorite
                </button>
                <button
                  type="button"
                  onClick={() => setProgress(toggleInterviewMastered(deckId, card.id))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium",
                    isMastered
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-ds-border",
                  )}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Mastered
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
