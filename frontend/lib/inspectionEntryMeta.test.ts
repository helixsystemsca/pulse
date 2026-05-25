import { describe, expect, it } from "vitest";
import { resolveInspectionEquipmentOptions } from "@/lib/inspectionEntryMeta";
import type { InspectionTemplate } from "@/lib/inspectionsLogsTypes";

const base: InspectionTemplate = {
  id: "t1",
  type: "inspection",
  name: "Ride-on Mowers",
  checklist_items: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("resolveInspectionEquipmentOptions", () => {
  it("uses equipment_options when present", () => {
    expect(
      resolveInspectionEquipmentOptions({
        ...base,
        equipment_options: [
          { id: "jd", label: "John Deere" },
          { id: "ventrac", label: "Ventrac" },
        ],
      }),
    ).toHaveLength(2);
  });

  it("falls back to legacy linked_equipment_id", () => {
    expect(
      resolveInspectionEquipmentOptions({
        ...base,
        linked_equipment_id: "equip-99",
      }),
    ).toEqual([{ id: "equip-99", label: "equip-99" }]);
  });
});
