import { describe, expect, it } from "vitest";
import { formatWorkOrderNumber, workRequestDisplayId } from "./display-id";

describe("work order display id", () => {
  it("formats WO# with zero padding", () => {
    expect(formatWorkOrderNumber(1)).toBe("WO#0001");
    expect(formatWorkOrderNumber(42)).toBe("WO#0042");
  });

  it("prefers API display_id", () => {
    expect(
      workRequestDisplayId({ display_id: "WO#0007", work_order_number: 7, id: "x" }),
    ).toBe("WO#0007");
  });

  it("falls back to work_order_number", () => {
    expect(workRequestDisplayId({ display_id: null, work_order_number: 3, id: "abc" })).toBe("WO#0003");
  });
});
