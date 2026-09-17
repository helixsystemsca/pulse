import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Shift } from "./types";

vi.mock("@/lib/api", () => ({
  isApiMode: () => true,
  apiFetch: vi.fn(),
}));

import { apiFetch } from "@/lib/api";
import { persistScheduleShiftMove } from "./persist-shift";

const shift: Shift = {
  id: "11111111-1111-4111-8111-111111111111",
  workerId: "w1",
  date: "2026-09-16",
  startTime: "08:00",
  endTime: "16:00",
  shiftType: "day",
  zoneId: "fac-1",
  role: "worker",
  eventType: "work",
  shiftKind: "workforce",
};

describe("persistScheduleShiftMove", () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it("returns ok:false so callers keep local pending save", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("network down"));
    const result = await persistScheduleShiftMove({ ...shift, date: "2026-09-17" }, "recreation");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toMatch(/network down/i);
  });

  it("returns ok:true when the server accepts the move", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({});
    const result = await persistScheduleShiftMove({ ...shift, date: "2026-09-17" }, "recreation");
    expect(result).toEqual({ ok: true, serverId: shift.id });
  });
});
