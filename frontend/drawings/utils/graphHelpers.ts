export type SystemType = "fiber" | "irrigation" | "electrical" | "telemetry";

export type InfraAsset = {
  id: string;
  name: string;
  type: string;
  system_type: SystemType;
  x: number;
  y: number;
  notes?: string | null;
};

export type InfraConnection = {
  id: string;
  from_asset_id: string;
  to_asset_id: string;
  system_type: SystemType;
  connection_type: string;
  active: boolean;
};

export type TraceRouteResult = { asset_ids: string[]; connection_ids: string[] };

export type GraphFilters = {
  systems: Record<SystemType, boolean>;
};

export function systemColor(system: SystemType): { stroke: string; fill: string } {
  switch (system) {
    case "fiber":
      return { stroke: "rgba(59, 130, 246, 0.95)", fill: "rgba(59, 130, 246, 0.2)" };
    case "irrigation":
      return { stroke: "rgba(34, 197, 94, 0.95)", fill: "rgba(34, 197, 94, 0.2)" };
    case "electrical":
      return { stroke: "rgba(245, 158, 11, 0.98)", fill: "rgba(245, 158, 11, 0.2)" };
    default:
      return { stroke: "rgba(148, 163, 184, 0.95)", fill: "rgba(148, 163, 184, 0.2)" };
  }
}

export function getVisibleGraphElements(
  filters: GraphFilters,
  assets: InfraAsset[],
  connections: InfraConnection[],
): { visibleAssets: InfraAsset[]; visibleConnections: InfraConnection[] } {
  const sysOn = (s: SystemType) => filters.systems[s] !== false;
  const visibleAssets = assets.filter((a) => sysOn(a.system_type));
  const visibleConnections = connections.filter((c) => c.active && sysOn(c.system_type));
  return { visibleAssets, visibleConnections };
}

export function buildAdjacency(connections: InfraConnection[]): Map<string, Array<{ to: string; connectionId: string }>> {
  const adj = new Map<string, Array<{ to: string; connectionId: string }>>();
  for (const c of connections) {
    if (!c.active) continue;
    const a = c.from_asset_id;
    const b = c.to_asset_id;
    const ea = adj.get(a) ?? [];
    ea.push({ to: b, connectionId: c.id });
    adj.set(a, ea);
    const eb = adj.get(b) ?? [];
    eb.push({ to: a, connectionId: c.id });
    adj.set(b, eb);
  }
  return adj;
}

export function nearestAssetId(assets: InfraAsset[], x: number, y: number): string | null {
  let best: { id: string; d2: number } | null = null;
  for (const a of assets) {
    const dx = a.x - x;
    const dy = a.y - y;
    const d2 = dx * dx + dy * dy;
    if (!best || d2 < best.d2) best = { id: a.id, d2 };
  }
  return best?.id ?? null;
}

