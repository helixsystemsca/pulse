import { describe, expect, it } from "vitest";
import { createEmptySpatialDocument } from "@/spatial-engine/document/create-document";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import {
  advertisingPersistenceAdapter,
  type AdvertisingWallDomain,
} from "@/spatial-engine/persistence/advertising-adapter";
import {
  applyCalibrationDraft,
  computeAppliedCalibration,
  createCalibrationDraft,
} from "@/spatial-engine/intelligence/calibration";
import {
  evaluateDocumentCollisions,
  placementBlocked,
  validateInventoryPlacement,
} from "@/spatial-engine/intelligence/collision";
import { computeSpatialAnalytics, createProposalExport } from "@/spatial-engine/intelligence/analytics";
import { SpatialRevisionStack, restoreRevisionSnapshot } from "@/spatial-engine/intelligence/history";
import { nudgeToValidPlacement, snapRectPlacement } from "@/spatial-engine/intelligence/placement";
import { traceGraphRoute } from "@/spatial-engine/intelligence/routing";
import { createCollaborationSession, upsertParticipant } from "@/spatial-engine/intelligence/collaboration";

const SAMPLE_WALL: AdvertisingWallDomain = {
  id: "wall-1",
  name: "Test",
  width_inches: 100,
  height_inches: 60,
  backdropKind: "arena",
  blocks: [{ id: "b1", name: "A", x: 10, y: 10, width_inches: 20, height_inches: 10, status: "available" }],
  constraints: [
    { id: "c1", type: "polygon", constraintType: "blocked", points: [0, 0, 25, 0, 25, 25, 0, 25] },
  ],
};

function wallDoc() {
  return advertisingPersistenceAdapter.toDocument(SAMPLE_WALL);
}

describe("collision engine", () => {
  it("flags blocked constraint overlap", () => {
    const doc = wallDoc();
    const result = validateInventoryPlacement(doc, {
      id: "b1",
      x: 5,
      y: 5,
      width: 20,
      height: 10,
    });
    expect(result.valid).toBe(false);
    expect(result.violations.some((v) => v.kind === "constraint_blocked")).toBe(true);
  });

  it("allows placement outside blocked region", () => {
    const doc = wallDoc();
    const result = validateInventoryPlacement(doc, {
      id: "b1",
      x: 40,
      y: 40,
      width: 20,
      height: 10,
    });
    expect(result.valid).toBe(true);
  });

  it("evaluates all inventory on document", () => {
    const doc = wallDoc();
    const map = evaluateDocumentCollisions(doc);
    expect(map.size).toBe(1);
  });
});

describe("calibration workflow", () => {
  it("applies calibration to document coordinate space", () => {
    const doc = wallDoc();
    const draft = {
      ...createCalibrationDraft(),
      pointA: { x: 0, y: 0 },
      pointB: { x: 100, y: 0 },
      realWorldDistance: 10,
      distanceUnit: "ft" as const,
    };
    const next = applyCalibrationDraft(doc, draft);
    expect(next?.calibration?.status).toBe("applied");
    expect(next?.coordinateSpace.kind).toBe("calibrated");
  });

  it("computes scale from two points", () => {
    const applied = computeAppliedCalibration(
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      100,
      "in",
    );
    expect(applied.worldUnitsPerPixel).toBeCloseTo(2, 5);
  });
});

describe("placement", () => {
  it("snaps to grid", () => {
    const doc = wallDoc();
    const snapped = snapRectPlacement(11, 11, 20, 10, doc, {
      gridSize: 5,
      gridEnabled: true,
      snapThreshold: 4,
    });
    expect(snapped.x % 5).toBe(0);
    expect(snapped.y % 5).toBe(0);
  });

  it("nudges invalid placement", () => {
    const doc = wallDoc();
    const result = nudgeToValidPlacement(
      doc,
      { id: "b1", x: 5, y: 5, width: 20, height: 10 },
      { gridSize: 1, gridEnabled: false, snapThreshold: 6 },
    );
    expect(typeof result.valid).toBe("boolean");
  });
});

describe("revision stack", () => {
  it("undo restores prior document", () => {
    const stack = new SpatialRevisionStack({ maxDepth: 10 });
    const doc = wallDoc();
    stack.resetBaseline(doc);
    const inv = getDocumentLayer(doc, "inventory")!;
    const before = inv.items[0]!.geometry.x;
    stack.push(doc);
    inv.items[0]!.geometry.x = 99;
    const undone = stack.undo(doc);
    expect(undone).not.toBeNull();
    expect(getDocumentLayer(undone!, "inventory")?.items[0]?.geometry.x).toBe(before);
  });
});

describe("routing", () => {
  it("traces path between graph nodes", () => {
    const doc = createEmptySpatialDocument({
      id: "infra-1",
      workspaceId: "infrastructure",
      includeDefaultLayers: false,
      coordinateSpace: {
        kind: "pixel",
        linearUnit: "px",
        extent: { minX: 0, minY: 0, maxX: 500, maxY: 500 },
      },
    });
    doc.layers.push({
      id: "g1",
      type: "graph",
      visible: true,
      zIndex: 1,
      nodes: [
        { id: "n1", position: { x: 0, y: 0 }, metadata: {} },
        { id: "n2", position: { x: 100, y: 0 }, metadata: {} },
      ],
      edges: [{ id: "e1", fromNodeId: "n1", toNodeId: "n2", metadata: {} }],
    });
    const trace = traceGraphRoute(doc, "n1", "n2");
    expect(trace.found).toBe(true);
    expect(trace.nodeIds).toEqual(["n1", "n2"]);
    expect(trace.points).toHaveLength(2);
  });
});

describe("analytics", () => {
  it("computes utilization summary", () => {
    const doc = wallDoc();
    const summary = computeSpatialAnalytics(doc);
    expect(summary.inventoryCount).toBe(1);
    expect(summary.constraintCount).toBe(1);
    expect(summary.utilizationPct).toBeGreaterThan(0);
  });

  it("exports proposal summary", () => {
    const doc = wallDoc();
    const proposal = createProposalExport(doc, "summary");
    expect(proposal.documentId).toBe("wall-1");
    expect(proposal.summary.inventoryCount).toBe(1);
  });
});

describe("collaboration", () => {
  it("tracks participant cursors", () => {
    let session = createCollaborationSession("doc-1", "rev-1");
    session = upsertParticipant(session, {
      userId: "u1",
      cursor: { x: 10, y: 20 },
    });
    expect(session.participants).toHaveLength(1);
    expect(session.participants[0]!.cursor).toEqual({ x: 10, y: 20 });
  });
});
