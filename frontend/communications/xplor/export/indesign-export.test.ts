import { describe, expect, it } from "vitest";
import { runPublicationPipeline } from "../pipeline";

const SAMPLE = `<pstyle:Eventage>6 - 9 yrs
<pstyle:Eventname>Tiny Timbers
<pstyle:Eventdescription>Come along for camp fun!
<pstyle:Location>Location: Centennial Park
<pstyle:Instructor>Jane Doe
<pstyle:Eventdetail>M-F 9:00am-12:00pm Jul 06-Jul 10 $129/5 187651
<pstyle:Eventdetail>Fee: $0
<pstyle:Extrafee>$24 materials`;

describe("InDesign export", () => {
  it("emits stable paragraph style tags", () => {
    const { export: exp, document } = runPublicationPipeline(SAMPLE);
    expect(exp.taggedTxt).toContain("<pstyle:ProgramTitle>");
    expect(exp.taggedTxt).toContain("<pstyle:AgeGroup>");
    expect(exp.taggedTxt).toContain("<pstyle:SessionDays>");
    expect(exp.taggedTxt).toContain("<pstyle:SessionTime>");
    expect(exp.taggedTxt).toContain("<pstyle:SessionDate>");
    expect(exp.taggedTxt).toContain("<pstyle:SessionPrice>");
    expect(exp.taggedTxt).toContain("<pstyle:ProgramCode>187651");
    expect(exp.taggedTxt.indexOf("<pstyle:ProgramTitle>")).toBeLessThan(
      exp.taggedTxt.indexOf("<pstyle:AgeGroup>"),
    );
    expect(document.entries[0]!.sessionGroups[0]!.sessions.length).toBeGreaterThanOrEqual(1);
  });

  it("groups sessions under age range", () => {
    const { document } = runPublicationPipeline(SAMPLE);
    const entry = document.entries[0]!;
    expect(entry.sessionGroups.length).toBeGreaterThanOrEqual(1);
    expect(entry.sessionGroups[0]!.ageGroup).toContain("6");
  });

  it("produces RTF wrapper", () => {
    const { export: exp } = runPublicationPipeline(SAMPLE);
    expect(exp.taggedRtf).toMatch(/^\{\\rtf1/);
    expect(exp.paragraphCount).toBeGreaterThan(5);
  });
});
