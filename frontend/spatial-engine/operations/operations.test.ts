import { describe, expect, it } from "vitest";
import { createEmptySpatialDocument } from "@/spatial-engine/document/create-document";
import type { SpatialCoordinateSpace } from "@/spatial-engine/document/types";

const TEST_COORDINATE_SPACE: SpatialCoordinateSpace = {
  kind: "pixel",
  linearUnit: "px",
  extent: { minX: 0, minY: 0, maxX: 1000, maxY: 1000 },
};

function testDoc(id: string, workspaceId: "infrastructure" | "advertising" = "infrastructure") {
  return createEmptySpatialDocument({
    id,
    workspaceId,
    coordinateSpace: TEST_COORDINATE_SPACE,
    includeDefaultLayers: false,
  });
}
import { createInventoryLayer, createConstraintLayer } from "@/spatial-engine/document/layers";
import {
  readEntityLinks,
  upsertEntityLink,
  buildOperationalOverlays,
  buildConstraintOperationalWarnings,
  createNamedSnapshot,
  restoreNamedSnapshot,
  SpatialSnapshotRegistry,
} from "@/spatial-engine/operations";

describe("operations — entity links", () => {
  it("round-trips entity links in feature metadata", () => {
    const meta = upsertEntityLink({}, { kind: "work_order", id: "wo-1", label: "Pump repair" });
    const links = readEntityLinks(meta);
    expect(links).toHaveLength(1);
    expect(links[0]!.id).toBe("wo-1");
  });
});

describe("operations — overlays", () => {
  it("builds work order and telemetry overlays from context", () => {
    const doc = testDoc("map-1");
    const overlays = buildOperationalOverlays(doc, {
      workOrders: [
        {
          id: "wo-1",
          title: "Leak",
          status: "open",
          position: { x: 100, y: 200 },
        },
      ],
      telemetry: [
        {
          id: "t-1",
          label: "Temp",
          position: { x: 50, y: 50 },
          value: 85,
          unit: "F",
        },
      ],
    });
    expect(overlays.some((o) => o.kind === "maintenance_alert")).toBe(true);
    expect(overlays.some((o) => o.kind === "sensor_telemetry")).toBe(true);
  });

  it("builds constraint warnings for blocked regions", () => {
    const doc = testDoc("wall-1", "advertising");
    doc.layers = [
      createConstraintLayer(
        { id: "constraints" },
        [
          {
            id: "c1",
            geometry: { kind: "polygon", points: [0, 0, 50, 0, 50, 50, 0, 50] },
            metadata: { constraintType: "blocked" },
          },
        ],
      ),
      createInventoryLayer(
        { id: "inventory" },
        [
          {
            id: "b1",
            geometry: { kind: "rect", x: 5, y: 5, width: 20, height: 10 },
            metadata: {},
          },
        ],
      ),
    ];
    const warnings = buildConstraintOperationalWarnings(doc);
    expect(warnings.length).toBeGreaterThan(0);
    const overlays = buildOperationalOverlays(doc, {}, { constraintWarnings: true });
    expect(overlays.some((o) => o.kind === "constraint_warning" || o.kind === "safety_zone")).toBe(true);
  });
});

describe("operations — snapshots", () => {
  it("creates and restores named snapshots", () => {
    const doc = testDoc("snap-doc");
    doc.metadata.title = "Before edit";
    const snap = createNamedSnapshot(doc, { name: "Publish v1", source: "publish" });
    const restored = restoreNamedSnapshot(snap);
    expect(restored.metadata.title).toBe("Before edit");
  });

  it("registry tracks audit entries", () => {
    const reg = new SpatialSnapshotRegistry();
    const doc = testDoc("audit-doc");
    reg.save(doc, { name: "Baseline" });
    expect(reg.list("audit-doc")).toHaveLength(1);
    expect(reg.getAudit("audit-doc").length).toBeGreaterThan(0);
  });
});
