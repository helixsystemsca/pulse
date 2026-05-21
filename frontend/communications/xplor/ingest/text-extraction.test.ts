import { describe, expect, it } from "vitest";
import { runPublicationPipeline } from "../pipeline";
import {
  detectInputFormat,
  extractPlainTextFromRaw,
  normalizeInputText,
  preprocessInput,
} from "./text-extraction";

const TAGGED = `<pstyle:Eventage>3 - 5 yrs
<pstyle:Eventname>Tiny Timbers
<pstyle:Eventdescription>Camp fun.
<pstyle:Eventdetail>M-F 9am Jul 6 $10 12345`;

const RTF_WRAPPED = `{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\f0\\par ${TAGGED.replace(/\n/g, "\\par ")} \\par}`;

describe("detectInputFormat", () => {
  it("uses extension for txt and rtf", () => {
    expect(detectInputFormat("export.txt")).toBe("txt");
    expect(detectInputFormat("export.rtf")).toBe("rtf");
  });

  it("detects rtf from payload signature", () => {
    expect(detectInputFormat(null, RTF_WRAPPED)).toBe("rtf");
  });
});

describe("preprocessInput", () => {
  it("normalizes txt without stripping", () => {
    const { plainText, isXplorTagged, sourceFormat } = preprocessInput(TAGGED, {
      filename: "x.txt",
    });
    expect(sourceFormat).toBe("txt");
    expect(plainText).toContain("<pstyle:Eventage>");
    expect(isXplorTagged).toBe(true);
  });

  it("extracts rtf then parses with shared pipeline", () => {
    const { plainText, isXplorTagged } = preprocessInput(RTF_WRAPPED, { filename: "x.rtf" });
    expect(isXplorTagged).toBe(true);
    expect(plainText).toContain("<pstyle:Eventname>");
    const { document } = runPublicationPipeline(RTF_WRAPPED, { filename: "x.rtf" });
    expect(document.entries.length).toBeGreaterThan(0);
  });

  it("normalizeInputText collapses excess blank lines", () => {
    expect(normalizeInputText("a\r\n\r\n\r\n\nb")).toBe("a\n\nb");
  });

  it("extractPlainTextFromRaw leaves txt unchanged", () => {
    expect(extractPlainTextFromRaw(TAGGED, "txt")).toBe(TAGGED);
  });
});
