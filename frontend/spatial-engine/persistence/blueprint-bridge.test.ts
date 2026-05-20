import { describe, expect, it } from "vitest";
import type { BlueprintElement } from "@/components/zones-devices/blueprint-types";
import { createEmptySpatialDocument } from "@/spatial-engine/document/create-document";
import {
  blueprintElementsFromDocument,
  blueprintLayersFromDocument,
  mergeBlueprintIntoDocument,
} from "@/spatial-engine/persistence/blueprint-bridge";

describe("blueprint-bridge", () => {
  it("round-trips zone and symbol elements via document layers", () => {
    const elements: BlueprintElement[] = [
      {
        id: "z1",
        type: "zone",
        x: 10,
        y: 20,
        width: 100,
        height: 80,
        name: "Lobby",
        path_points: [10, 20, 110, 20, 110, 100, 10, 100],
      },
      {
        id: "s1",
        type: "symbol",
        x: 50,
        y: 60,
        symbol_type: "exit",
        name: "Exit",
      },
    ];
    const base = createEmptySpatialDocument({ id: "map-1", workspaceId: "infrastructure" });
    const doc = mergeBlueprintIntoDocument(base, {
      elements,
      layers: [{ id: "default", name: "Default" }],
    });
    const restored = blueprintElementsFromDocument(doc);
    expect(restored).toHaveLength(2);
    expect(restored.find((e) => e.id === "z1")?.name).toBe("Lobby");
    expect(restored.find((e) => e.id === "s1")?.symbol_type).toBe("exit");
    expect(blueprintLayersFromDocument(doc)).toEqual([{ id: "default", name: "Default" }]);
  });
});
