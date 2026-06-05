import { describe, expect, it } from "vitest";
import { qrScanHref, qrScanPath } from "@/lib/qr/qr-scan-url";

describe("qr-scan-url", () => {
  it("extracts scan path from API absolute URL", () => {
    expect(qrScanPath("https://panorama.helixsystems.ca/qr/ABC123")).toBe("/qr/ABC123");
    expect(qrScanPath("/qr/XYZ")).toBe("/qr/XYZ");
  });

  it("builds same-origin href from token", () => {
    expect(qrScanHref("ABC123")).toBe("/qr/ABC123");
    expect(qrScanHref("https://ops.helixsystems.ca/qr/DEF456")).toBe("/qr/DEF456");
  });
});
