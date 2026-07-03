import { parseInterviewDeckDocument } from "@/lib/training/interviews/validate";
import type { InterviewDeckDocument, InterviewDeckSummary } from "@/lib/training/interviews/types";

const MANIFEST_URL = "/api/training/interviews";

/** Legacy part files merged into single decks. */
const DECK_ID_ALIASES: Record<string, string> = {
  csrd_team_lead_part_1: "csrd_team_lead",
  csrd_team_lead_part_2: "csrd_team_lead",
  csrd_team_lead_part_3: "csrd_team_lead",
  csrd_team_lead_part_4: "csrd_team_lead",
};

function resolveDeckId(deckId: string): string {
  return DECK_ID_ALIASES[deckId] ?? deckId;
}

export { resolveDeckId };

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
  const resolvedId = resolveDeckId(deckId);
  const summaries = await listInterviewDecks();
  const summary = summaries.find((d) => d.id === resolvedId);
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
  if (document.deck.id !== resolvedId) {
    throw new Error(
      `Deck file "${summary.sourceFile}" has id "${document.deck.id}" but expected "${resolvedId}".`,
    );
  }
  return { document, sourceFile: summary.sourceFile };
}
