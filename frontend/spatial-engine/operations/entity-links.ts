import { getDocumentLayer } from "@/spatial-engine/document/query";
import {
  isAnnotationLayer,
  isConstraintLayer,
  isDeviceLayer,
  isGraphLayer,
  isInventoryLayer,
  isSensorLayer,
  isZoneLayer,
} from "@/spatial-engine/document/layers/types";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import {
  SPATIAL_ENTITY_LINKS_KEY,
  type SpatialEntityLink,
  type SpatialEntityLinkKind,
} from "@/spatial-engine/operations/types";

export function readEntityLinks(metadata: Record<string, unknown> | undefined): SpatialEntityLink[] {
  if (!metadata) return [];
  const raw = metadata[SPATIAL_ENTITY_LINKS_KEY];
  if (!Array.isArray(raw)) return [];
  return raw.filter(isEntityLink);
}

export function writeEntityLinks(
  metadata: Record<string, unknown>,
  links: SpatialEntityLink[],
): Record<string, unknown> {
  return { ...metadata, [SPATIAL_ENTITY_LINKS_KEY]: links };
}

export function upsertEntityLink(
  metadata: Record<string, unknown>,
  link: SpatialEntityLink,
): Record<string, unknown> {
  const existing = readEntityLinks(metadata).filter((l) => !(l.kind === link.kind && l.id === link.id));
  return writeEntityLinks(metadata, [...existing, link]);
}

export function findLinksByKind(
  doc: SpatialDocument,
  kind: SpatialEntityLinkKind,
): Array<{ featureId: string; layerType: string; link: SpatialEntityLink }> {
  const out: Array<{ featureId: string; layerType: string; link: SpatialEntityLink }> = [];
  for (const layer of doc.layers) {
    const items =
      layer.type === "graph"
        ? layer.nodes.map((n) => ({ id: n.id, metadata: n.metadata }))
        : layer.type === "inventory"
          ? layer.items.map((i) => ({ id: i.id, metadata: i.metadata }))
          : layer.type === "constraints"
            ? layer.features.map((f) => ({ id: f.id, metadata: f.metadata }))
            : layer.type === "annotations"
              ? layer.features.map((f) => ({ id: f.id, metadata: f.metadata }))
              : layer.type === "zones"
                ? layer.features.map((f) => ({ id: f.id, metadata: f.metadata }))
                : layer.type === "devices"
                  ? layer.features.map((f) => ({ id: f.id, metadata: f.metadata }))
                  : layer.type === "sensors"
                    ? layer.features.map((f) => ({ id: f.id, metadata: f.metadata }))
                    : [];
    for (const item of items) {
      for (const link of readEntityLinks(item.metadata)) {
        if (link.kind === kind) {
          out.push({ featureId: item.id, layerType: layer.type, link });
        }
      }
    }
  }
  return out;
}

export function resolveLinkPosition(
  doc: SpatialDocument,
  featureId: string,
  layerType: string,
): { x: number; y: number } | null {
  const layer = doc.layers.find((l) => l.type === layerType);
  if (!layer) return null;
  if (isGraphLayer(layer)) {
    const node = layer.nodes.find((n) => n.id === featureId);
    return node ? { x: node.position.x, y: node.position.y } : null;
  }
  if (isInventoryLayer(layer)) {
    const item = layer.items.find((i) => i.id === featureId);
    return item
      ? { x: item.geometry.x + item.geometry.width / 2, y: item.geometry.y + item.geometry.height / 2 }
      : null;
  }
  if (isDeviceLayer(layer) || isSensorLayer(layer)) {
    const f = layer.features.find((x) => x.id === featureId);
    return f ? { x: f.position.x, y: f.position.y } : null;
  }
  if (isAnnotationLayer(layer) || isZoneLayer(layer) || isConstraintLayer(layer)) {
    const f = layer.features.find((x) => x.id === featureId);
    if (!f) return null;
    if (f.geometry.kind === "symbol") {
      return { x: f.geometry.position.x, y: f.geometry.position.y };
    }
    if ("points" in f.geometry && f.geometry.points.length >= 2) {
      return { x: f.geometry.points[0]!, y: f.geometry.points[1]! };
    }
  }
  return null;
}

function isEntityLink(v: unknown): v is SpatialEntityLink {
  if (!v || typeof v !== "object") return false;
  const o = v as SpatialEntityLink;
  return typeof o.kind === "string" && typeof o.id === "string";
}
