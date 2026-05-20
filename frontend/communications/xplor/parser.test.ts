import { describe, expect, it } from "vitest";
import { parseXplorTaggedText } from "./parser";
import { runPublicationPipeline } from "./pipeline";

const SAMPLE = `<pstyle:Eventage>3 - 5 yrs
<pstyle:Eventname>Tiny Timbers - Crafty Critters
<pstyle:Eventdescription>Explore nature through crafts.
<pstyle:Location>Location: Community Hall
<pstyle:Instructor>
<pstyle:Eventdetail>Jul 06 9:00am-12:00pm Jun 24-Jun 24
<pstyle:Eventdetail>Fee: $0
<pstyle:Extrafee>$24/1 materials`;

describe("parseXplorTaggedText", () => {
  it("extracts structured program fields", () => {
    const { programs } = parseXplorTaggedText(SAMPLE);
    expect(programs).toHaveLength(1);
    expect(programs[0]!.age).toBe("3 - 5 yrs");
    expect(programs[0]!.title).toBe("Tiny Timbers - Crafty Critters");
    expect(programs[0]!.location).toContain("Community Hall");
    expect(programs[0]!.sessions.length).toBeGreaterThanOrEqual(1);
    expect(programs[0]!.extraFees).toContain("$24");
  });
});

describe("runPublicationPipeline", () => {
  it("normalizes and exports InDesign paragraph styles", () => {
    const { export: exp, document } = runPublicationPipeline(SAMPLE);
    expect(exp.taggedTxt).toContain("<pstyle:ProgramTitle>");
    expect(exp.taggedTxt).toContain("Jul 6");
    expect(exp.taggedTxt).toContain("9am");
    expect(exp.taggedTxt).not.toContain("Location:");
    expect(exp.taggedTxt).toContain("Free");
    expect(document.entries[0]!.sessions[0]!.time).toContain("9");
  });

  it("applies OCR phrase fix in description", () => {
    const raw = `<pstyle:Eventage>3 - 5 yrs
<pstyle:Eventname>Test
<pstyle:Eventdescription>One along for fun.
<pstyle:Eventdetail>M-F 9am Jul 6 $10 12345`;
    const { document } = runPublicationPipeline(raw);
    expect(document.entries[0]!.description).toContain("Come along");
  });
});
