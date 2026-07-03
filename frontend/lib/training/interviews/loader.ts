import { parseInterviewDeckDocument } from "@/lib/training/interviews/validate";
import type { InterviewDeckDocument, InterviewDeckSummary } from "@/lib/training/interviews/types";

const MANIFEST_URL = "/api/training/interviews";

export async function listInterviewDecks(): Promise<InterviewDeckSummary[]> {
  const res = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not load interview decks (${res.status}).`);
  }
  const rows = (await res.json()) as InterviewDeckSummary[];
  return rows.sort((a, b) => a.title.localeCompare(b.title));
}

export async function loadInterviewDeckById(deckId: string): Promise<{
  document: InterviewDeckDocument;
  sourceFile: string;
}> {
  const summaries = await listInterviewDecks();
  const summary = summaries.find((d) => d.id === deckId);
  if (!summary) {
    throw new Error(`Interview deck "${deckId}" was not found.`);
  }
  const res = await fetch(`/training/interviews/${encodeURIComponent(summary.sourceFile)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Could not load deck file (${res.status}).`);
  }
  const raw = await res.json();
  const document = parseInterviewDeckDocument(raw, summary.sourceFile);
  if (document.deck.id !== deckId) {
    throw new Error(
      `Deck file "${summary.sourceFile}" has id "${document.deck.id}" but expected "${deckId}".`,
    );
  }
  return { document, sourceFile: summary.sourceFile };
}
