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
  it("no period — only create period", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: null,
      hasDraftPreview: false,
      hasPendingServerSave: false,
      hasPersistedShifts: false,
    });
    expect(vm.primaryAction).toBe("create_period");
    expect(vm.showAvailabilityTools).toBe(false);
    expect(vm.assignmentsEnabled).toBe(false);
  });

  it("period exists, no shifts — generate is primary", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: period,
      hasDraftPreview: false,
      hasPendingServerSave: false,
      hasPersistedShifts: false,
    });
    expect(vm.state).toBe("empty");
    expect(vm.primaryAction).toBe("generate_schedule");
    expect(vm.showAvailabilityTools).toBe(true);
  });

  it("draft_generated — save is primary", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: period,
      hasDraftPreview: true,
      hasPendingServerSave: false,
      hasPersistedShifts: false,
    });
    expect(vm.primaryAction).toBe("save_changes");
    expect(vm.showSecondaryRebuild).toBe(true);
  });

  it("draft_saved — publish when synced", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: period,
      hasDraftPreview: false,
      hasPendingServerSave: false,
      hasPersistedShifts: true,
    });
    expect(vm.primaryAction).toBe("publish_schedule");
    expect(vm.showSecondaryPublish).toBe(false);
  });

  it("draft_saved with pending edits — save first", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: period,
      hasDraftPreview: false,
      hasPendingServerSave: true,
      hasPersistedShifts: true,
    });
    expect(vm.primaryAction).toBe("save_changes");
    expect(vm.showSecondaryPublish).toBe(true);
  });

  it("published — edit icon only; assignments via sidebar", () => {
    const vm = deriveScheduleWorkflow({
      activePeriod: { ...period, status: "published" },
      hasDraftPreview: false,
      hasPendingServerSave: false,
      hasPersistedShifts: true,
    });
    expect(vm.primaryAction).toBeNull();
    expect(vm.showSecondaryNotify).toBe(false);
    expect(vm.showSecondaryEdit).toBe(true);
    expect(vm.showAvailabilityTools).toBe(false);
    expect(vm.assignmentsEnabled).toBe(true);
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
