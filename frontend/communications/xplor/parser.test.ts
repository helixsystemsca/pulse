import { describe, expect, it } from "vitest";
import { parseXplorTaggedText } from "./parser";
import { normalizePrograms } from "./normalizer";
import { exportProgramsToTaggedText } from "./exporter";

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

  it("normalizes and exports with cleaned ordering", () => {
    const { programs } = parseXplorTaggedText(SAMPLE);
    const normalized = normalizePrograms(programs);
    const out = exportProgramsToTaggedText(normalized);
    expect(out.indexOf("<pstyle:Eventage>")).toBeLessThan(out.indexOf("<pstyle:Eventname>"));
    expect(out).toContain("Jul 6");
    expect(out).toContain("9am");
    expect(out).not.toContain("Location:");
    expect(out).not.toMatch(/<pstyle:Instructor>\s*\n/);
    expect(out).toContain("Free");
  });
});
