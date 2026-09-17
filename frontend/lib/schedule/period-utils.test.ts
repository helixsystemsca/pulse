import { describe, expect, it } from "vitest";
import {
  findUnpublishedMayPeriod,
  mayPeriodAutopublishEnabled,
} from "./period-utils";

describe("mayPeriodAutopublishEnabled", () => {
  it("is off in production so unpublished May periods are not surprise-published", () => {
    expect(mayPeriodAutopublishEnabled("production")).toBe(false);
  });

  it("is allowed in non-production environments", () => {
    expect(mayPeriodAutopublishEnabled("development")).toBe(true);
    expect(mayPeriodAutopublishEnabled("test")).toBe(true);
  });
});

describe("findUnpublishedMayPeriod", () => {
  it("finds a May draft without mutating it", () => {
    const periods = [
      { id: "p1", start_date: "2026-05-01", status: "draft" },
      { id: "p2", start_date: "2026-06-01", status: "draft" },
    ];
    expect(findUnpublishedMayPeriod(periods)?.id).toBe("p1");
    expect(periods[0]?.status).toBe("draft");
  });
});
