import type { InterviewCard, InterviewCardFilters } from "@/lib/training/interviews/types";

export function shuffleInterviewCards<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export function uniqueInterviewCategories(cards: InterviewCard[]): string[] {
  return [...new Set(cards.map((c) => c.category))].sort((a, b) => a.localeCompare(b));
}

export function uniqueInterviewDifficulties(cards: InterviewCard[]): string[] {
  return [...new Set(cards.map((c) => c.difficulty).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filterInterviewCards(
  cards: InterviewCard[],
  filters: InterviewCardFilters,
  progress: { favorites: number[]; mastered: number[] },
): InterviewCard[] {
  let out = [...cards];
  const q = filters.search.trim().toLowerCase();

  if (q) {
    out = out.filter((c) => {
      const hay = [
        c.question,
        c.category,
        c.difficulty,
        c.bestStory,
        ...c.whatTheyAreEvaluating,
        ...c.answerFramework,
        ...c.keywords,
        ...c.watchFor,
        ...c.panelNotes.whatGoodSoundsLike,
        ...c.panelNotes.scoreFocus,
        c.star.situation,
        c.star.task,
        c.star.action,
        c.star.result,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }

  if (filters.categories.length) {
    out = out.filter((c) => filters.categories.includes(c.category));
  }

  if (filters.difficulties.length) {
    out = out.filter((c) => filters.difficulties.includes(c.difficulty));
  }

  if (filters.favoritesOnly) {
    const fav = new Set(progress.favorites);
    out = out.filter((c) => fav.has(c.id));
  }

  if (filters.masteredOnly) {
    const mas = new Set(progress.mastered);
    out = out.filter((c) => mas.has(c.id));
  }

  if (filters.hideMastered) {
    const mas = new Set(progress.mastered);
    out = out.filter((c) => !mas.has(c.id));
  }

  return out;
}

export function interviewProgressStats(
  cards: InterviewCard[],
  progress: { favorites: number[]; mastered: number[] },
): { total: number; mastered: number; favorites: number; remaining: number } {
  const total = cards.length;
  const mastered = progress.mastered.filter((id) => cards.some((c) => c.id === id)).length;
  const favorites = progress.favorites.filter((id) => cards.some((c) => c.id === id)).length;
  return { total, mastered, favorites, remaining: total - mastered };
}
