import type { InterviewCard, InterviewDeckDocument, InterviewDeckMeta, InterviewStar } from "@/lib/training/interviews/types";

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function isDeckMeta(v: unknown): v is InterviewDeckMeta {
  if (!v || typeof v !== "object") return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.id === "string" &&
    typeof d.title === "string" &&
    typeof d.organization === "string" &&
    typeof d.position === "string" &&
    typeof d.description === "string" &&
    typeof d.estimatedQuestions === "number" &&
    typeof d.version === "number"
  );
}

function isStar(v: unknown): v is InterviewStar {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.situation === "string" &&
    typeof s.task === "string" &&
    typeof s.action === "string" &&
    typeof s.result === "string"
  );
}

function isMinimalCard(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return typeof c.id === "number" && typeof c.category === "string" && typeof c.question === "string" && isStar(c.star);
}

function deckIdFromSourceFile(sourceFile: string): string {
  return sourceFile.replace(/\.json$/i, "");
}

function normalizeStar(star: InterviewStar): InterviewStar {
  return {
    situation: star.situation,
    task: star.task,
    action: star.action,
    result: star.result,
  };
}

function normalizeCard(raw: Record<string, unknown>): InterviewCard {
  const star = raw.star as InterviewStar;
  const panel = raw.panelNotes as Record<string, unknown> | undefined;
  return {
    id: raw.id as number,
    category: String(raw.category),
    difficulty: typeof raw.difficulty === "string" ? raw.difficulty : "",
    question: String(raw.question),
    whatTheyAreEvaluating: isStringArray(raw.whatTheyAreEvaluating) ? raw.whatTheyAreEvaluating : [],
    answerFramework: isStringArray(raw.answerFramework) ? raw.answerFramework : [],
    star: normalizeStar(star),
    keywords: isStringArray(raw.keywords) ? raw.keywords : [],
    bestStory: typeof raw.bestStory === "string" ? raw.bestStory : "",
    watchFor: isStringArray(raw.watchFor) ? raw.watchFor : [],
    panelNotes: {
      whatGoodSoundsLike: isStringArray(panel?.whatGoodSoundsLike) ? panel.whatGoodSoundsLike : [],
      scoreFocus: isStringArray(panel?.scoreFocus) ? panel.scoreFocus : [],
    },
  };
}

function normalizeDeckMeta(raw: Record<string, unknown>, sourceFile: string): InterviewDeckMeta {
  const deck = raw.deck;
  const cards = Array.isArray(raw.cards) ? raw.cards : [];
  const part = typeof raw.part === "number" ? raw.part : undefined;

  if (isDeckMeta(deck)) {
    return part != null ? { ...deck, part } : deck;
  }

  if (typeof deck === "string") {
    const id = deckIdFromSourceFile(sourceFile);
    const title = part != null ? `${deck} — Part ${part}` : deck;
    return {
      id,
      title,
      organization: typeof raw.organization === "string" ? raw.organization : "",
      position: typeof raw.position === "string" ? raw.position : "",
      description:
        typeof raw.description === "string"
          ? raw.description
          : part != null
            ? `Interview preparation — part ${part}`
            : "Interview preparation deck",
      estimatedQuestions:
        typeof raw.estimatedQuestions === "number" ? raw.estimatedQuestions : cards.length,
      version: typeof raw.version === "number" ? raw.version : 1,
      part,
    };
  }

  throw new Error("Interview deck must include `deck` as metadata object or title string.");
}

/**
 * Accepts rich coaching decks or slim STAR-answer decks (AI/user-authored).
 * `sourceFile` supplies stable `deck.id` when JSON uses string `deck` + `part`.
 */
export function parseInterviewDeckDocument(raw: unknown, sourceFile = "deck.json"): InterviewDeckDocument {
  if (!raw || typeof raw !== "object") {
    throw new Error("Interview deck must be a JSON object.");
  }
  const doc = raw as Record<string, unknown>;
  if (!Array.isArray(doc.cards) || !doc.cards.every(isMinimalCard)) {
    throw new Error(
      "Interview deck `cards` must be an array of objects with id, category, question, and star.",
    );
  }
  const deck = normalizeDeckMeta(doc, sourceFile);
  const cards = doc.cards.map((c) => normalizeCard(c as Record<string, unknown>));
  return { deck, cards };
}
