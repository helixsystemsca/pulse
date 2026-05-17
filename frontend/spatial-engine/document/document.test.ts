import { describe, expect, it } from "vitest";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import { deserializeSpatialDocument, serializeSpatialDocument } from "@/spatial-engine/document/serialization";
import {
  advertisingPersistenceAdapter,
  seedAdvertisingMockStore,
  type AdvertisingWallDomain,
} from "@/spatial-engine/persistence/advertising-adapter";
import {
  documentToInfrastructureMap,
  infrastructureMapToDocument,
} from "@/spatial-engine/persistence/infrastructure-adapter";

const SAMPLE_WALL: AdvertisingWallDomain = {
  id: "test-wall",
  name: "Test Wall",
  width_inches: 120,
  height_inches: 48,
  backdropKind: "arena",
  blocks: [
    {
      id: "b1",
      name: "Slot A",
      x: 10,
      y: 10,
      width_inches: 20,
      height_inches: 12,
      status: "available",
    },
  ],
  constraints: [
    {
      id: "c1",
      type: "polygon",
      constraintType: "blocked",
      points: [0, 0, 30, 0, 30, 30, 0, 30],
    },
  ],
};

describe("SpatialDocument", () => {
  it("round-trips advertising wall through serialize", () => {
    const doc = advertisingPersistenceAdapter.toDocument(SAMPLE_WALL);
    const json = advertisingPersistenceAdapter.serialize(doc);
    const restored = advertisingPersistenceAdapter.deserialize(json);
    const wall = advertisingPersistenceAdapter.fromDocument(restored);

    expect(wall.id).toBe(SAMPLE_WALL.id);
    expect(wall.blocks).toHaveLength(1);
    expect(wall.blocks[0]!.width_inches).toBe(20);
    expect(wall.constraints[0]!.points).toHaveLength(8);
    expect(getDocumentLayer(restored, "inventory")?.items).toHaveLength(1);
  });

  it("mock store load/save", async () => {
    seedAdvertisingMockStore([SAMPLE_WALL]);
    const loaded = await advertisingPersistenceAdapter.load("test-wall");
    expect(loaded.name).toBe("Test Wall");
    loaded.blocks[0]!.status = "occupied";
    await advertisingPersistenceAdapter.save("test-wall", loaded);
    const doc = advertisingPersistenceAdapter.toDocument(await advertisingPersistenceAdapter.load("test-wall"));
    expect(doc.layers.find((l) => l.type === "inventory")).toBeDefined();
  });

  it("infrastructure bundle maps graph layer", () => {
    const bundle = {
      mapId: "map-1",
      name: "Arena",
      imageUrl: "/img.png",
      worldWidth: 4200,
      worldHeight: 2800,
      assets: [{ id: "a1", name: "Pump", type: "pump", system_type: "irrigation", x: 100, y: 200 }],
      connections: [
        {
          id: "e1",
          from_asset_id: "a1",
          to_asset_id: "a1",
          system_type: "irrigation",
          connection_type: "link",
          active: true,
        },
      ],
      annotations: [{ id: "z1", symbolType: "zone", x: 50, y: 50, label: "Zone A" }],
    };

    const doc = infrastructureMapToDocument(bundle);
    expect(doc.coordinateSpace.kind).toBe("pixel");
    expect(getDocumentLayer(doc, "graph")?.nodes).toHaveLength(1);
    expect(getDocumentLayer(doc, "annotations")?.features).toHaveLength(1);

    const json = serializeSpatialDocument(doc);
    const roundTrip = documentToInfrastructureMap(deserializeSpatialDocument(json));
    expect(roundTrip.assets[0]!.x).toBe(100);
    expect(roundTrip.annotations[0]!.symbolType).toBe("zone");
  });
});
