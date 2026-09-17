import { describe, expect, it } from "vitest";
import { resolveScheduleAssignFacilityId } from "./assign-facility";

const zones = [{ id: "arena" }, { id: "pool" }, { id: "fitness" }];

describe("resolveScheduleAssignFacilityId", () => {
  it("uses a single active facility filter", () => {
    expect(
      resolveScheduleAssignFacilityId({
        workerId: "w1",
        zones,
        shifts: [],
        facilityFilterIds: ["pool"],
      }),
    ).toBe("pool");
  });

  it("prefers the worker home facility over zones[0]", () => {
    expect(
      resolveScheduleAssignFacilityId({
        workerId: "w1",
        zones,
        shifts: [],
        homeFacilityId: "fitness",
      }),
    ).toBe("fitness");
  });

  it("falls back to last-used assignment for that worker", () => {
    expect(
      resolveScheduleAssignFacilityId({
        workerId: "w1",
        zones,
        shifts: [
          { workerId: "w1", zoneId: "pool", date: "2026-09-10" },
          { workerId: "w1", zoneId: "arena", date: "2026-09-14" },
          { workerId: "w2", zoneId: "fitness", date: "2026-09-15" },
        ],
      }),
    ).toBe("arena");
  });
});
