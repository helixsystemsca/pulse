import { describe, expect, it } from "vitest";
import { deriveScheduleWorkflow, pickPeriodForVisibleRange } from "@/lib/schedule/schedule-workflow";
import type { SchedulePeriodLite } from "@/components/schedule/SchedulePeriodModal";

const period: SchedulePeriodLite = {
  id: "p1",
  start_date: "2026-05-01",
  end_date: "2026-05-31",
  status: "draft",
  availability_deadline: null,
  publish_deadline: null,
};

describe("deriveScheduleWorkflow", () => {
  it("empty when period exists but no shifts", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: period,
      hasDraftPreview: false,
      hasPendingServerSave: false,
      hasPersistedShifts: false,
    });
    expect(vm.state).toBe("empty");
    expect(vm.assignmentsEnabled).toBe(false);
    expect(vm.mode).toBe("planning");
  });

  it("draft_generated when preview open", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: period,
      hasDraftPreview: true,
      hasPendingServerSave: false,
      hasPersistedShifts: false,
    });
    expect(vm.state).toBe("draft_generated");
  });

  it("draft_saved when persisted and synced", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: period,
      hasDraftPreview: false,
      hasPendingServerSave: false,
      hasPersistedShifts: true,
    });
    expect(vm.state).toBe("draft_saved");
    expect(vm.assignmentsEnabled).toBe(false);
  });

  it("published from period status", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: { ...period, status: "published" },
      hasDraftPreview: false,
      hasPendingServerSave: false,
      hasPersistedShifts: true,
    });
    expect(vm.state).toBe("published");
    expect(vm.assignmentsEnabled).toBe(true);
    expect(vm.mode).toBe("operational");
  });
});

describe("pickPeriodForVisibleRange", () => {
  it("prefers published overlap", () => {
    const picked = pickPeriodForVisibleRange(
      [
        { ...period, id: "d", status: "draft" },
        { ...period, id: "pub", status: "published" },
      ],
      "2026-05-10",
      "2026-05-20",
    );
    expect(picked?.id).toBe("pub");
  });
});
