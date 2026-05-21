import { describe, expect, it } from "vitest";
import { parseXplorTaggedText } from "./tagged-parser";
import { runPublicationPipeline } from "../pipeline";

/** Snippet mirroring real Xplor export order: name/description BEFORE age. */
const DROP_IN_SNIPPET = `<pstyle:Service>Soccer | Reservable Activities
<pstyle:Eventname>60+ Indoor Soccer
<pstyle:Eventdescription>Soccer blurb for 60yrs+ players.
<pstyle:Eventage>60 yrs -
<pstyle:Location>Location: North Saanich Middle School Gymnasium
<pstyle:Instructor>Instructor: Neil Munro
<pstyle:Eventdetail>Tu 7:30pm-9:00pm  May 05-Jun 30   $8/9  187703
<pstyle:Extrafees>
<pstyle:Service>Volleyball | Reservable Activities
<pstyle:Eventname>Volleyball Social Game Play | Reservable
<pstyle:Eventdescription>Volleyball blurb with registration required.
<pstyle:Eventage>16 yrs -
<pstyle:Location>Location: North Saanich Middle School Gymnasium
<pstyle:Instructor>Instructor: Claire Liaros
<pstyle:Eventdetail>Su 6:00pm-7:30pm  Jul 05-Aug 30   $8/$4/$6/8  187584
<pstyle:Extrafees>`;

describe("parseXplorTaggedText program boundaries", () => {
  it("keeps age/location/instructor/sessions on the same program as Eventname", () => {
    const { programs } = parseXplorTaggedText(DROP_IN_SNIPPET);
    expect(programs).toHaveLength(2);

    const soccer = programs[0]!;
    expect(soccer.title).toContain("60+ Indoor Soccer");
    expect(soccer.age).toContain("60");
    expect(soccer.instructor).toContain("Neil Munro");
    expect(soccer.sessions[0]).toContain("187703");
    expect(soccer.sessions[0]).toContain("$8/9");

    const volleyball = programs[1]!;
    expect(volleyball.title).toContain("Volleyball Social");
    expect(volleyball.age).toContain("16");
    expect(volleyball.instructor).toContain("Claire Liaros");
    expect(volleyball.sessions[0]).toContain("187584");
    expect(volleyball.sessions[0]).not.toContain("187703");
  });

  it("normalizes each program with its own metadata in the pipeline", () => {
    const { document } = runPublicationPipeline(DROP_IN_SNIPPET);
    expect(document.entries).toHaveLength(2);

    expect(document.entries[0]!.ageRange).toBe("60+ YEARS");
    expect(document.entries[0]!.instructor).toContain("Neil Munro");
    expect(document.entries[0]!.sessions[0]!.programCode).toBe("187703");

    expect(document.entries[1]!.ageRange).toBe("16+ YEARS");
    expect(document.entries[1]!.instructor).toContain("Claire Liaros");
    expect(document.entries[1]!.sessions[0]!.programCode).toBe("187584");
  });

  it("still supports Eventage-first exports", () => {
    const raw = `<pstyle:Eventage>3 - 5 yrs
<pstyle:Eventname>Tiny Timbers
<pstyle:Eventdescription>Forest fun.
<pstyle:Eventdetail>M-F 9am Jul 6 $10 12345`;
    const { programs } = parseXplorTaggedText(raw);
    expect(programs).toHaveLength(1);
    expect(programs[0]!.age).toContain("3");
    expect(programs[0]!.title).toContain("Tiny Timbers");
    expect(programs[0]!.sessions[0]).toContain("12345");
  });
});
