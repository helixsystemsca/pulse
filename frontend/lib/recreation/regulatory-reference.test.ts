import { describe, expect, it } from "vitest";
import {
  REGULATORY_CLASSIFICATIONS,
  REGULATORY_TOPIC_CATEGORIES,
  cardMatchesQuery,
  classificationTone,
  parsePulsePointers,
  serializePulsePointers,
  userKeywordTags,
} from "@/lib/recreation/regulatory-reference";

describe("regulatory reference helpers", () => {
  it("includes required topic categories and classifications", () => {
    expect(REGULATORY_TOPIC_CATEGORIES).toContain("Chief Engineer");
    expect(REGULATORY_TOPIC_CATEGORIES).toContain("Interior Health / Pools");
    expect(REGULATORY_CLASSIFICATIONS).toContain("Law/Regulation");
    expect(REGULATORY_CLASSIFICATIONS).toContain("Best practice");
  });

  it("filters cards by keyword", () => {
    const card = {
      title: "Chief engineer / plant operator responsibility overview",
      summary: "Technical Safety BC directives",
      topic_category: "Chief Engineer",
      classification: "Law/Regulation",
    };
    expect(cardMatchesQuery(card, "chief engineer")).toBe(true);
    expect(cardMatchesQuery(card, "playground")).toBe(false);
    expect(cardMatchesQuery({ title: "OH&S", topic_category: "OH&S" }, "ohs")).toBe(true);
  });

  it("parses pulse pointers and classification tones", () => {
    expect(parsePulsePointers([{ label: "Emergency", href: "/recreation/emergency" }])).toEqual([
      { label: "Emergency", href: "/recreation/emergency" },
    ]);
    expect(parsePulsePointers("nope")).toEqual([]);
    expect(classificationTone("Law/Regulation")).toContain("rose");
    expect(classificationTone("Internal note")).toContain("stone");
  });

  it("keeps user keywords separate from seed tags", () => {
    expect(
      userKeywordTags(["vernon-starter", "regulatory-reference", "seed-key:chief-engineer-plant-responsibility", "Chief Engineer", "ice plant"]),
    ).toEqual(["ice plant"]);
  });

  it("serializes pulse pointers without empty rows", () => {
    expect(
      serializePulsePointers([
        { label: "Emergency", href: "/recreation/emergency" },
        { label: "  ", href: "/x" },
        { label: "Emergency", href: "/recreation/emergency" },
      ]),
    ).toEqual([{ label: "Emergency", href: "/recreation/emergency" }]);
  });
});
