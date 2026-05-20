import { describe, expect, it } from "vitest";
import { createEmptySpatialDocument } from "@/spatial-engine/document/create-document";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import { wallPlanToDocument } from "@/spatial-engine/persistence/advertising-adapter";
import { infrastructureMapToDocument } from "@/spatial-engine/persistence/infrastructure-adapter";
import { addInventoryItem, patchGraphNode } from "@/spatial-engine/runtime/document-mutations";
import { graphAssetsFromDocument, wallPlanFromDocument } from "@/spatial-engine/runtime/selectors";
import { useSpatialRuntimeStore } from "@/spatial-engine/runtime/spatial-runtime-store";

describe("SpatialRuntimeStore", () => {
  it("loads and mutates active document", () => {
    useSpatialRuntimeStore.getState().resetSession("infrastructure");
    const bundle = {
      mapId: "m1",
      name: "Test",
      imageUrl: null,
      worldWidth: 1000,
      worldHeight: 800,
      assets: [{ id: "a1", name: "N1", type: "node", system_type: "fiber", x: 10, y: 20 }],
      connections: [],
      annotations: [],
    };
    const doc = infrastructureMapToDocument(bundle);
    useSpatialRuntimeStore.getState().loadDocument(doc, { pushHistory: false });
    expect(useSpatialRuntimeStore.getState().session.activeDocumentId).toBe("m1");
    useSpatialRuntimeStore.getState().updateActiveDocument(
      (d) => patchGraphNode(d, "a1", { position: { x: 99, y: 88 } }),
      { pushHistory: false },
    );
    const active = useSpatialRuntimeStore.getState().documents.m1?.document;
    const assets = graphAssetsFromDocument(active ?? null);
    expect(assets[0]?.x).toBe(99);
  });
});

describe("document-mutations", () => {
  it("adds inventory to advertising document", () => {
    const wall = wallPlanToDocument({
      id: "w1",
      name: "Wall",
      width_inches: 100,
      height_inches: 60,
      backdropKind: "arena",
      blocks: [],
      constraints: [],
    });
    const next = addInventoryItem(wall, {
      id: "b1",
      geometry: { kind: "rect", x: 1, y: 2, width: 10, height: 5 },
      metadata: { name: "Slot A" },
    });
    const inv = getDocumentLayer(next, "inventory");
    expect(inv?.items).toHaveLength(1);
    expect(wallPlanFromDocument(next)?.blocks[0]?.name).toBe("Slot A");
  });
});

describe("layer types", () => {
  it("supports zones and devices layer shells", () => {
    const doc = createEmptySpatialDocument({
      id: "z",
      workspaceId: "infrastructure",
      coordinateSpace: {
        kind: "pixel",
        linearUnit: "px",
        extent: { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      },
      includeDefaultLayers: true,
    });
    expect(doc.layers.some((l) => l.type === "graph")).toBe(true);
  });
});
