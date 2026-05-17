import type { BlueprintElement, BlueprintLayer } from "@/components/zones-devices/blueprint-types";
import { isRoom } from "@/components/zones-devices/blueprint-types";
import {
  createAnnotationLayer,
  createDeviceLayer,
  createZoneLayer,
  type AnnotationFeatureDocument,
  type DeviceFeatureDocument,
  type SpatialDocumentLayer,
  type ZoneFeatureDocument,
} from "@/spatial-engine/document/layers";
import { getDocumentLayer } from "@/spatial-engine/document/query";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { FlatPolygonPoints } from "@/spatial-engine/types/spatial";

const BLUEPRINT_SNAPSHOT_KEY = "blueprint";

export type BlueprintDocumentSlice = {
  elements: BlueprintElement[];
  layers: BlueprintLayer[];
};

function rectToFlatPoly(x: number, y: number, w: number, h: number): FlatPolygonPoints {
  return [x, y, x + w, y, x + w, y + h, x, y + h];
}

function zoneGeometry(el: BlueprintElement): FlatPolygonPoints {
  if (el.path_points && el.path_points.length >= 6) return el.path_points;
  const w = el.width ?? 120;
  const h = el.height ?? 80;
  return rectToFlatPoly(el.x, el.y, w, h);
}

function annotationGeometry(el: BlueprintElement): AnnotationFeatureDocument["geometry"] {
  if (el.path_points && el.path_points.length >= 4) {
    const open = el.type === "connection" || el.metadata?.annotate_open_stroke || el.symbol_type === "map_pen";
    if (open) {
      return { kind: "polyline", points: el.path_points };
    }
    return { kind: "polygon", points: el.path_points };
  }
  if (el.width != null && el.height != null) {
    return {
      kind: "rect",
      rect: { x: el.x, y: el.y, width: el.width, height: el.height },
    };
  }
  if (el.symbol_type || el.type === "symbol" || el.type === "device") {
    return {
      kind: "symbol",
      position: { x: el.x, y: el.y },
      symbolType: el.symbol_type ?? el.type,
    };
  }
  return { kind: "point", position: { x: el.x, y: el.y } };
}

function blueprintSnapshot(el: BlueprintElement): Record<string, unknown> {
  return { [BLUEPRINT_SNAPSHOT_KEY]: el };
}

function readBlueprintSnapshot(metadata: Record<string, unknown>): BlueprintElement | null {
  const raw = metadata[BLUEPRINT_SNAPSHOT_KEY];
  if (!raw || typeof raw !== "object") return null;
  const el = raw as BlueprintElement;
  return typeof el.id === "string" && typeof el.type === "string" ? el : null;
}

export function blueprintElementsToLayers(elements: BlueprintElement[]): {
  zones: ZoneFeatureDocument[];
  devices: DeviceFeatureDocument[];
  annotations: AnnotationFeatureDocument[];
} {
  const zones: ZoneFeatureDocument[] = [];
  const devices: DeviceFeatureDocument[] = [];
  const annotations: AnnotationFeatureDocument[] = [];

  for (const el of elements) {
    if (el.type === "zone" || isRoom(el)) {
      zones.push({
        id: el.id,
        geometry: { kind: "polygon", points: zoneGeometry(el) },
        metadata: blueprintSnapshot(el),
      });
      continue;
    }
    if (el.type === "device") {
      devices.push({
        id: el.id,
        position: { x: el.x, y: el.y },
        deviceType: el.device_kind ?? "device",
        metadata: blueprintSnapshot(el),
      });
      continue;
    }
    annotations.push({
      id: el.id,
      geometry: annotationGeometry(el),
      metadata: blueprintSnapshot(el),
    });
  }

  return { zones, devices, annotations };
}

export function mergeBlueprintIntoDocument(
  doc: SpatialDocument,
  slice: BlueprintDocumentSlice,
): SpatialDocument {
  const { zones, devices, annotations } = blueprintElementsToLayers(slice.elements);
  const zoneShell = getDocumentLayer(doc, "zones");
  const deviceShell = getDocumentLayer(doc, "devices");
  const annotationShell = getDocumentLayer(doc, "annotations");

  const layers: SpatialDocumentLayer[] = doc.layers.filter(
    (l) => l.type !== "zones" && l.type !== "devices" && l.type !== "annotations",
  );

  layers.push(
    createZoneLayer(
      zoneShell
        ? { id: zoneShell.id, visible: zoneShell.visible, zIndex: zoneShell.zIndex, persistence: zoneShell.persistence }
        : { id: "zones", visible: true, zIndex: 15, persistence: { adapterKey: "infrastructure.blueprint.zones" } },
      zones,
    ),
    createDeviceLayer(
      deviceShell
        ? { id: deviceShell.id, visible: deviceShell.visible, zIndex: deviceShell.zIndex, persistence: deviceShell.persistence }
        : { id: "devices", visible: true, zIndex: 25, persistence: { adapterKey: "infrastructure.blueprint.devices" } },
      devices,
    ),
    createAnnotationLayer(
      annotationShell
        ? {
            id: annotationShell.id,
            visible: annotationShell.visible,
            zIndex: annotationShell.zIndex,
            persistence: annotationShell.persistence,
          }
        : { id: "annotations", visible: true, zIndex: 30, persistence: { adapterKey: "infrastructure.blueprint.annotations" } },
      annotations,
    ),
  );

  return {
    ...doc,
    layers,
    metadata: {
      ...doc.metadata,
      domain: {
        ...doc.metadata.domain,
        blueprintLayers: slice.layers,
      },
      updatedAt: new Date().toISOString(),
    },
  };
}

export function blueprintElementsFromDocument(doc: SpatialDocument | null): BlueprintElement[] {
  if (!doc) return [];
  const out: BlueprintElement[] = [];
  const seen = new Set<string>();

  const push = (el: BlueprintElement | null) => {
    if (!el || seen.has(el.id)) return;
    seen.add(el.id);
    out.push(el);
  };

  for (const layerType of ["zones", "devices", "annotations"] as const) {
    const layer = getDocumentLayer(doc, layerType);
    if (!layer) continue;
    const features =
      layerType === "zones"
        ? layer.features
        : layerType === "devices"
          ? layer.features
          : layer.features;
    for (const f of features) {
      push(readBlueprintSnapshot(f.metadata));
    }
  }

  return out;
}

export function blueprintLayersFromDocument(doc: SpatialDocument | null): BlueprintLayer[] {
  if (!doc) return [];
  const raw = doc.metadata.domain?.blueprintLayers;
  if (!Array.isArray(raw)) return [];
  return raw.filter((l): l is BlueprintLayer => Boolean(l && typeof l === "object" && "id" in l && "name" in l));
}
