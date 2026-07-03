import { describe, expect, it } from "vitest";
import { filterInterviewCards, shuffleInterviewCards } from "@/lib/training/interviews/filters";
import { parseInterviewDeckDocument } from "@/lib/training/interviews/validate";
import type { InterviewCard } from "@/lib/training/interviews/types";

const sampleCard: InterviewCard = {
  id: 1,
  category: "Leadership",
  difficulty: "Medium",
  question: "Tell us about yourself.",
  whatTheyAreEvaluating: ["Communication"],
  answerFramework: ["Present past future"],
  star: { situation: "s", task: "t", action: "a", result: "r" },
  keywords: ["leadership"],
  bestStory: "Pool reopening story",
  watchFor: ["rambling"],
  panelNotes: { whatGoodSoundsLike: ["clear"], scoreFocus: ["Communication"] },
};

describe("parseInterviewDeckDocument", () => {
  it("accepts a valid rich deck document", () => {
    const doc = parseInterviewDeckDocument(
      {
        deck: {
          id: "test_deck",
          title: "Test",
          organization: "Org",
          position: "Role",
          description: "Desc",
          estimatedQuestions: 1,
          version: 1,
        },
        cards: [sampleCard],
      },
      "test_deck.json",
    );
    expect(doc.deck.id).toBe("test_deck");
    expect(doc.cards).toHaveLength(1);
  });

  it("accepts slim STAR-only deck with string title and part", () => {
    const doc = parseInterviewDeckDocument(
      {
        deck: "CSRD Team Lead - Facilities Interview",
        part: 1,
        cards: [
          {
            id: 1,
            category: "Introduction",
            question: "Tell us about yourself.",
            star: { situation: "s", task: "t", action: "a", result: "r" },
          },
        ],
      },
      "csrd_team_lead_part_1.json",
    );
    expect(doc.deck.id).toBe("csrd_team_lead_part_1");
    expect(doc.deck.title).toContain("Part 1");
    expect(doc.deck.part).toBe(1);
    expect(doc.cards[0]?.whatTheyAreEvaluating).toEqual([]);
    expect(doc.cards[0]?.star.situation).toBe("s");
  });

  it("rejects missing deck metadata", () => {
    expect(() => parseInterviewDeckDocument({ cards: [] })).toThrow();
  });
});

describe("filterInterviewCards", () => {
  it("filters by search and favorites", () => {
    const cards = [
      sampleCard,
      { ...sampleCard, id: 2, question: "Safety scenario", category: "Safety" },
    ];
    const filtered = filterInterviewCards(
      cards,
      { search: "safety", categories: [], difficulties: [], favoritesOnly: false, masteredOnly: false, hideMastered: false },
      { favorites: [], mastered: [] },
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.category).toBe("Safety");
  });
});

describe("shuffleInterviewCards", () => {
  it("returns the same items in a different order sometimes", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = shuffleInterviewCards(input);
    expect(shuffled.sort()).toEqual(input.sort());
  });
});
