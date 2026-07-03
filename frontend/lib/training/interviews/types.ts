/** Interview preparation deck — JSON-driven schema (no hardcoded deck content). */

export type InterviewDifficulty = string;

export type InterviewDeckMeta = {
  id: string;
  title: string;
  organization: string;
  position: string;
  description: string;
  estimatedQuestions: number;
  version: number;
  /** Present when deck JSON uses `{ deck: "...", part: N }` format. */
  part?: number;
};

export type InterviewStar = {
  situation: string;
  task: string;
  action: string;
  result: string;
};

export type InterviewPanelNotes = {
  whatGoodSoundsLike: string[];
  scoreFocus: string[];
};

/** Normalized card — optional coaching fields may be empty for STAR-only decks. */
export type InterviewCard = {
  id: number;
  category: string;
  difficulty: InterviewDifficulty;
  question: string;
  whatTheyAreEvaluating: string[];
  answerFramework: string[];
  star: InterviewStar;
  keywords: string[];
  bestStory: string;
  watchFor: string[];
  panelNotes: InterviewPanelNotes;
};

export type InterviewDeckDocument = {
  deck: InterviewDeckMeta;
  cards: InterviewCard[];
};

export type InterviewDeckSummary = InterviewDeckMeta & {
  cardCount: number;
  sourceFile: string;
};

export type InterviewStudyMode = "study" | "random" | "mock";

export type InterviewDeckProgress = {
  favorites: number[];
  mastered: number[];
  lastIndex: number;
  lastStudiedAt: string | null;
};

export type InterviewCardFilters = {
  search: string;
  categories: string[];
  difficulties: string[];
  favoritesOnly: boolean;
  masteredOnly: boolean;
  hideMastered: boolean;
};
