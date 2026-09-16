import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appDir = path.resolve(fileURLToPath(new URL("../../app", import.meta.url)));

function icoSizes(buf: Buffer): number[] {
  expect(buf.readUInt16LE(0)).toBe(0);
  expect(buf.readUInt16LE(2)).toBe(1);
  const count = buf.readUInt16LE(4);
  const sizes: number[] = [];
  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    sizes.push(buf.readUInt8(entry));
  }
  return sizes;
}

describe("app favicon", () => {
  it("ships a multi-size Vernon ICO and keeps PNG metadata icons (no Helix H generators)", () => {
    expect(existsSync(path.join(appDir, "icon.tsx"))).toBe(false);
    expect(existsSync(path.join(appDir, "apple-icon.tsx"))).toBe(false);
    expect(existsSync(path.join(appDir, "icon.png"))).toBe(true);
    expect(existsSync(path.join(appDir, "apple-icon.png"))).toBe(true);

    const ico = readFileSync(path.join(appDir, "favicon.ico"));
    expect(icoSizes(ico).sort((a, b) => a - b)).toEqual([16, 32]);
  });
});
