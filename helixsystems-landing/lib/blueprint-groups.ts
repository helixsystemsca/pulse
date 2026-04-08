/**
 * Blueprint editor: logical groups (children ids) + helpers for selection and bounds.
 */

import type { BlueprintElement } from "@/components/zones-devices/blueprint-types";
import { elementWorldAabb, zonePolygonFlat } from "@/lib/blueprint-layout";

export function buildBlueprintChildToGroupMap(elements: BlueprintElement[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const el of elements) {
    if (el.type !== "group" || !el.children?.length) continue;
    for (const cid of el.children) m.set(cid, el.id);
  }
  return m;
}

export function resolveBlueprintHitToSelectionId(elements: BlueprintElement[], hitElementId: string): string {
  const m = buildBlueprintChildToGroupMap(elements);
  return m.get(hitElementId) ?? hitElementId;
}

/** Dedupe: multiple hits that map to the same group collapse to one id. */
export function canonicalizeBlueprintSelectionIds(elements: BlueprintElement[], ids: string[]): string[] {
  const m = buildBlueprintChildToGroupMap(elements);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const c = m.get(id) ?? id;
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  return out;
}

export function isTopLevelBlueprintElement(elements: BlueprintElement[], id: string): boolean {
  return !buildBlueprintChildToGroupMap(elements).has(id);
}

/** Ids to move/transform when the user edits selection (expand groups to their children; keep doors out of nudge). */
export function expandBlueprintSelectionToEditableIds(elements: BlueprintElement[], selectedIds: string[]): Set<string> {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const out = new Set<string>();
  for (const id of selectedIds) {
    const el = byId.get(id);
    if (!el) continue;
    if (el.type === "connection") continue;
    if (el.type === "group" && el.children?.length) for (const c of el.children) out.add(c);
    else out.add(id);
  }
  return out;
}

/** Group + all descendants removed from the document. */
export function expandBlueprintSelectionForDeletion(elements: BlueprintElement[], selectedIds: string[]): Set<string> {
  const drop = expandBlueprintSelectionToEditableIds(elements, selectedIds);
  for (const id of selectedIds) {
    const el = elements.find((e) => e.id === id);
    if (el?.type === "group" || el?.type === "connection") drop.add(id);
  }
  return drop;
}

export function computeBlueprintGroupBounds(elements: BlueprintElement[], childIds: string[]): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  let L = Infinity;
  let R = -Infinity;
  let T = Infinity;
  let B = -Infinity;
  const byId = new Map(elements.map((e) => [e.id, e]));
  for (const cid of childIds) {
    const c = byId.get(cid);
    if (!c) continue;
    const a = elementWorldAabb(c);
    if (!a) continue;
    L = Math.min(L, a.L);
    R = Math.max(R, a.R);
    T = Math.min(T, a.T);
    B = Math.max(B, a.B);
  }
  if (!Number.isFinite(L)) return null;
  return { x: L, y: T, width: Math.max(1, R - L), height: Math.max(1, B - T) };
}

export function syncBlueprintGroupBounds(elements: BlueprintElement[]): BlueprintElement[] {
  return elements.map((el) => {
    if (el.type !== "group" || !el.children?.length) return el;
    const b = computeBlueprintGroupBounds(elements, el.children);
    if (!b) return el;
    return { ...el, x: b.x, y: b.y, width: b.width, height: b.height };
  });
}

export type GroupDragMembers =
  | { kind: "multi"; ids: string[] }
  | { kind: "group"; groupId: string; memberIds: string[] }
  | null;

/** Members that move together with the primary drag handle (Konva node id = primaryId). */
export function resolveBlueprintGroupDragMembers(
  elements: BlueprintElement[],
  selectedIds: string[],
  primaryId: string,
): GroupDragMembers {
  const childToGroup = buildBlueprintChildToGroupMap(elements);
  const gFromChild = childToGroup.get(primaryId);
  if (gFromChild && selectedIds.includes(gFromChild)) {
    const g = elements.find((e) => e.id === gFromChild && e.type === "group");
    if (g?.type === "group" && g.children && g.children.length > 0) {
      return { kind: "group", groupId: gFromChild, memberIds: [...g.children] };
    }
  }

  if (selectedIds.length < 2 || !selectedIds.includes(primaryId)) return null;

  const memberIds: string[] = [];
  for (const id of selectedIds) {
    const o = elements.find((e) => e.id === id);
    if (!o || o.type === "door" || o.type === "group" || o.type === "connection") continue;
    if (childToGroup.has(id)) continue;
    memberIds.push(id);
  }
  if (memberIds.length < 2) return null;

  const prim = elements.find((e) => e.id === primaryId);
  if (prim?.type === "zone" && zonePolygonFlat(prim)) return null;

  return { kind: "multi", ids: memberIds };
}

/** ≥2 elements, top-level, not locked, eligible types (no door / group / grouped child). */
export function isBlueprintElementEffectivelyLocked(elements: BlueprintElement[], el: BlueprintElement): boolean {
  if (el.locked) return true;
  const childToGroup = buildBlueprintChildToGroupMap(elements);
  const gid = childToGroup.get(el.id);
  if (!gid) return false;
  const g = elements.find((e) => e.id === gid && e.type === "group");
  return Boolean(g?.locked);
}

export function blueprintIdsEligibleToFormGroup(elements: BlueprintElement[], selectedIds: string[]): string[] | null {
  if (selectedIds.length < 2) return null;
  const childToGroup = buildBlueprintChildToGroupMap(elements);
  const pick: string[] = [];
  for (const id of selectedIds) {
    const o = elements.find((e) => e.id === id);
    if (!o || isBlueprintElementEffectivelyLocked(elements, o)) continue;
    if (o.type === "door" || o.type === "group" || o.type === "connection") continue;
    if (childToGroup.has(id)) continue;
    pick.push(id);
  }
  return pick.length >= 2 ? pick : null;
}
