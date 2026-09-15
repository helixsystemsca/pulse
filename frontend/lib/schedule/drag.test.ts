import { describe, expect, it } from "vitest";
import {
  resolvePaletteDropPayload,
  resolveShiftDropPayload,
  resolveWorkerDropPayload,
  setWorkerDragData,
  WORKER_DRAG_MIME,
} from "./drag";
import type { ScheduleDragSession } from "./types";

function fakeDt(types: string[], data: Record<string, string> = {}): DataTransfer {
  return {
    types,
    getData: (k: string) => data[k] ?? "",
    setData: () => {},
    effectAllowed: "all",
    dropEffect: "none",
  } as unknown as DataTransfer;
}

describe("resolveWorkerDropPayload", () => {
  it("prefers the live drag session when MIME types are missing", () => {
    const session: ScheduleDragSession = { kind: "worker", workerId: "w-session" };
    expect(resolveWorkerDropPayload(fakeDt([]), session)).toEqual({ workerId: "w-session" });
  });

  it("reads custom MIME when session is empty", () => {
    const dt = fakeDt([WORKER_DRAG_MIME], { [WORKER_DRAG_MIME]: JSON.stringify({ workerId: "w-mime" }) });
    expect(resolveWorkerDropPayload(dt, null)).toEqual({ workerId: "w-mime" });
  });
});

describe("resolveShiftDropPayload", () => {
  it("uses session when custom MIME is omitted", () => {
    const session: ScheduleDragSession = { kind: "shift", shiftId: "s1", duplicate: true };
    expect(resolveShiftDropPayload(fakeDt([]), session)).toEqual({ shiftId: "s1", duplicate: true });
  });
});

describe("resolvePaletteDropPayload", () => {
  it("uses session for palette drops", () => {
    const session: ScheduleDragSession = { kind: "palette", paletteKind: "shift", code: "D2" };
    expect(resolvePaletteDropPayload(fakeDt([]), session)).toEqual({ paletteKind: "shift", code: "D2" });
  });
});

describe("setWorkerDragData", () => {
  it("sets copy effect", () => {
    const stored: Record<string, string> = {};
    const dt = {
      setData: (k: string, v: string) => {
        stored[k] = v;
      },
      effectAllowed: "none",
    } as unknown as DataTransfer;
    setWorkerDragData(dt, { workerId: "w1" });
    expect(stored[WORKER_DRAG_MIME]).toContain("w1");
    expect(dt.effectAllowed).toBe("copy");
  });
});
