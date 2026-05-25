import { describe, expect, it, vi } from "vitest";
import { dedupeInflightRequest } from "@/lib/api-request-dedupe";

describe("dedupeInflightRequest", () => {
  it("reuses the same promise for concurrent calls with the same key", async () => {
    const fn = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return { items: [] };
    });
    const [a, b] = await Promise.all([
      dedupeInflightRequest("workers:list:/api/workers", fn),
      dedupeInflightRequest("workers:list:/api/workers", fn),
    ]);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });
});
