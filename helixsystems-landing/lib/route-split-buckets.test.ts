import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { isMarketingPath, isProductPath } from "./route-split-buckets";

function collectPageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...collectPageFiles(full));
    } else if (name === "page.tsx") {
      out.push(full);
    }
  }
  return out;
}

/** Map each App Router page file to a concrete pathname for classification checks. */
function pageFileToExamplePath(appRoot: string, file: string): string {
  const rel = relative(appRoot, file).replace(/\\/g, "/");
  if (rel === "page.tsx") return "/";
  if (!rel.endsWith("/page.tsx")) {
    throw new Error(`Expected page.tsx file, got: ${rel}`);
  }
  const dirPart = rel.slice(0, -"/page.tsx".length);
  const segments = dirPart.split("/").map((seg) => (/^\[.+\]$/.test(seg) ? "_param" : seg));
  return `/${segments.join("/")}`;
}

describe("route-split-buckets", () => {
  const appRoot = join(process.cwd(), "app");

  it("classifies every app page route as marketing XOR product (no gap, no overlap)", () => {
    const files = collectPageFiles(appRoot);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const path = pageFileToExamplePath(appRoot, file);
      const m = isMarketingPath(path);
      const p = isProductPath(path);

      expect(
        m || p,
        `Uncategorized path "${path}" (${relative(process.cwd(), file).replace(/\\/g, "/")}) — add a prefix to MARKETING or PRODUCT in route-split-buckets.ts`,
      ).toBe(true);

      expect(
        !(m && p),
        `Path "${path}" matches both marketing and product buckets (${relative(process.cwd(), file).replace(/\\/g, "/")})`,
      ).toBe(true);
    }
  });

  it("helpers match a few known routes", () => {
    expect(isMarketingPath("/")).toBe(true);
    expect(isProductPath("/")).toBe(false);

    expect(isMarketingPath("/pulse")).toBe(true);
    expect(isProductPath("/pulse")).toBe(false);

    expect(isMarketingPath("/landing-variants/a")).toBe(true);

    expect(isMarketingPath("/blueprint")).toBe(true);
    expect(isProductPath("/blueprint")).toBe(false);

    expect(isProductPath("/login")).toBe(true);
    expect(isMarketingPath("/login")).toBe(false);

    expect(isProductPath("/equipment/_param")).toBe(true);
    expect(isProductPath("/system/companies/_param")).toBe(true);
  });
});
