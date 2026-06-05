import { describe, expect, it } from "vitest";
import {
  DEFAULT_REORDER_OUTPUTS,
  normalizeReorderOutputs,
  replenishmentQueueTabs,
  reorderOutputsLabel,
  toggleReorderOutput,
} from "@/lib/inventory/reorder-outputs-config";

describe("reorder-outputs-config", () => {
  it("defaults to material requisition", () => {
    expect(DEFAULT_REORDER_OUTPUTS).toEqual(["material_requisition"]);
    expect(normalizeReorderOutputs(undefined)).toEqual(["material_requisition"]);
  });

  it("falls back to procurement mode", () => {
    expect(normalizeReorderOutputs([], "shopping_list")).toEqual(["shopping_list"]);
  });

  it("requires at least one output when toggling off", () => {
    expect(toggleReorderOutput(["material_requisition"], "material_requisition", false)).toEqual([
      "material_requisition",
    ]);
  });

  it("formats labels", () => {
    expect(reorderOutputsLabel(["material_requisition", "email_draft"])).toContain("Material Requisition");
  });

  it("builds replenishment queue tabs from enabled outputs", () => {
    expect(replenishmentQueueTabs(["material_requisition", "shopping_list"])).toEqual([
      "queue",
      "material_requisition",
      "shopping_list",
    ]);
  });
});
