import type { InterviewDeckProgress } from "@/lib/training/interviews/types";

const STORAGE_KEY = "pulse.interview_deck_progress";

const EMPTY: InterviewDeckProgress = {
  favorites: [],
  mastered: [],
  lastIndex: 0,
  lastStudiedAt: null,
};

type Store = Record<string, InterviewDeckProgress>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Store;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function readInterviewDeckProgress(deckId: string): InterviewDeckProgress {
  const row = readStore()[deckId];
  if (!row) return { ...EMPTY };
  return {
    favorites: [...(row.favorites ?? [])],
    mastered: [...(row.mastered ?? [])],
    lastIndex: typeof row.lastIndex === "number" ? row.lastIndex : 0,
    lastStudiedAt: row.lastStudiedAt ?? null,
  };
}

export function writeInterviewDeckProgress(deckId: string, progress: InterviewDeckProgress): void {
  const store = readStore();
  store[deckId] = progress;
  writeStore(store);
}

export function toggleInterviewFavorite(deckId: string, cardId: number): InterviewDeckProgress {
  const current = readInterviewDeckProgress(deckId);
  const set = new Set(current.favorites);
  if (set.has(cardId)) set.delete(cardId);
  else set.add(cardId);
  const next = { ...current, favorites: [...set].sort((a, b) => a - b) };
  writeInterviewDeckProgress(deckId, next);
  return next;
}

export function toggleInterviewMastered(deckId: string, cardId: number): InterviewDeckProgress {
  const current = readInterviewDeckProgress(deckId);
  const set = new Set(current.mastered);
  if (set.has(cardId)) set.delete(cardId);
  else set.add(cardId);
  const next = { ...current, mastered: [...set].sort((a, b) => a - b) };
  writeInterviewDeckProgress(deckId, next);
  return next;
}

export function saveInterviewStudyIndex(deckId: string, index: number): InterviewDeckProgress {
  const current = readInterviewDeckProgress(deckId);
  const next = { ...current, lastIndex: index, lastStudiedAt: new Date().toISOString() };
  writeInterviewDeckProgress(deckId, next);
  return next;
}
