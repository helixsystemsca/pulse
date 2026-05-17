import { getDocumentLayer } from "@/spatial-engine/document/query";
import type { GraphEdgeDocument, GraphLayerDocument } from "@/spatial-engine/document/layers/types";
import type { SpatialDocument } from "@/spatial-engine/document/types";
import type { WorldPoint } from "@/spatial-engine/types/spatial";

export type GraphRouteTrace = {
  fromNodeId: string;
  toNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  /** Polyline in world space along the route (node centers in order). */
  points: WorldPoint[];
  found: boolean;
};

function buildAdjacency(graph: GraphLayerDocument): Map<string, { neighborId: string; edgeId: string }[]> {
  const adj = new Map<string, { neighborId: string; edgeId: string }[]>();
  const add = (from: string, to: string, edge: GraphEdgeDocument) => {
    const list = adj.get(from) ?? [];
    list.push({ neighborId: to, edgeId: edge.id });
    adj.set(from, list);
  };
  for (const edge of graph.edges) {
    add(edge.fromNodeId, edge.toNodeId, edge);
    add(edge.toNodeId, edge.fromNodeId, edge);
  }
  return adj;
}

/** BFS shortest path on undirected graph layer (deterministic: first edge wins at equal depth). */
export function traceGraphRoute(doc: SpatialDocument, fromNodeId: string, toNodeId: string): GraphRouteTrace {
  const empty: GraphRouteTrace = {
    fromNodeId,
    toNodeId,
    nodeIds: [],
    edgeIds: [],
    points: [],
    found: false,
  };

  if (fromNodeId === toNodeId) {
    const graph = getDocumentLayer(doc, "graph");
    const node = graph?.nodes.find((n) => n.id === fromNodeId);
    if (!node) return empty;
    return {
      fromNodeId,
      toNodeId,
      nodeIds: [fromNodeId],
      edgeIds: [],
      points: [{ x: node.position.x, y: node.position.y }],
      found: true,
    };
  }

  const graph = getDocumentLayer(doc, "graph");
  if (!graph) return empty;

  const adj = buildAdjacency(graph);
  const queue: string[] = [fromNodeId];
  const visited = new Set<string>([fromNodeId]);
  const parent = new Map<string, { nodeId: string; edgeId: string }>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === toNodeId) break;
    const neighbors = adj.get(current) ?? [];
    for (const { neighborId, edgeId } of neighbors) {
      if (visited.has(neighborId)) continue;
      visited.add(neighborId);
      parent.set(neighborId, { nodeId: current, edgeId });
      queue.push(neighborId);
    }
  }

  if (!visited.has(toNodeId)) return empty;

  const nodeIds: string[] = [];
  const edgeIds: string[] = [];
  let cursor: string | undefined = toNodeId;
  while (cursor !== undefined && cursor !== fromNodeId) {
    nodeIds.push(cursor);
    const p = parent.get(cursor);
    if (!p) break;
    edgeIds.push(p.edgeId);
    cursor = p.nodeId;
  }
  nodeIds.push(fromNodeId);
  nodeIds.reverse();
  edgeIds.reverse();

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const points = nodeIds
    .map((id) => nodeById.get(id))
    .filter((n): n is NonNullable<typeof n> => Boolean(n))
    .map((n) => ({ x: n.position.x, y: n.position.y }));

  return {
    fromNodeId,
    toNodeId,
    nodeIds,
    edgeIds,
    points,
    found: true,
  };
}
