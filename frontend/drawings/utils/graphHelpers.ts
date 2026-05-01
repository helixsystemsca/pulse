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

export type TraceRouteResult = {
  asset_ids: string[];
  connection_ids: string[];
  filtered_out_count?: number;
  reason?: string | null;
};

export type GraphFilters = {
  systems: Record<SystemType, boolean>;
};

export type FilterRule = {
  entity: "asset" | "connection";
  key: string;
  operator: "equals" | "not_equals" | "gt" | "lt" | "contains";
  value: string | number | boolean;
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
  attributesByEntityId: Record<string, Record<string, string | number | boolean>>,
  rules: FilterRule[],
): {
  visibleAssets: InfraAsset[];
  visibleConnections: InfraConnection[];
  dimAssetIds: Set<string>;
  dimConnectionIds: Set<string>;
} {
  const sysOn = (s: SystemType) => filters.systems[s] !== false;

  const coerce = (v: unknown): string | number | boolean => {
    if (typeof v === "number" || typeof v === "boolean") return v;
    const t = String(v ?? "").trim();
    if (t === "true") return true;
    if (t === "false") return false;
    const n = Number(t);
    if (Number.isFinite(n) && t !== "" && !Number.isNaN(n) && String(n) === t) return n;
    return t;
  };

  const matchesRule = (
    actual: string | number | boolean | undefined,
    op: FilterRule["operator"],
    expected: FilterRule["value"],
  ) => {
    const a = actual ?? "";
    const b = expected;
    if (op === "equals") return String(a) === String(b);
    if (op === "not_equals") return String(a) !== String(b);
    if (op === "contains") return String(a).toLowerCase().includes(String(b).toLowerCase());
    if (op === "gt" || op === "lt") {
      const an = typeof a === "number" ? a : Number(String(a));
      const bn = typeof b === "number" ? b : Number(String(b));
      if (!Number.isFinite(an) || !Number.isFinite(bn)) return false;
      return op === "gt" ? an > bn : an < bn;
    }
    return false;
  };

  const matchesAll = (entityKey: string, entityType: "asset" | "connection") => {
    const attrs = attributesByEntityId[entityKey] ?? {};
    const applicable = rules.filter((r) => r.entity === entityType && r.key.trim());
    if (applicable.length === 0) return true;
    for (const r of applicable) {
      const actual = attrs[r.key];
      if (!matchesRule(coerce(actual), r.operator, r.value)) return false;
    }
    return true;
  };

  const visibleAssets = assets.filter((a) => sysOn(a.system_type));
  const visibleConnections = connections.filter((c) => c.active && sysOn(c.system_type));

  const dimAssetIds = new Set<string>();
  for (const a of visibleAssets) {
    const key = `asset:${a.id}`;
    if (!matchesAll(key, "asset")) dimAssetIds.add(a.id);
  }

  const dimConnectionIds = new Set<string>();
  for (const c of visibleConnections) {
    const key = `connection:${c.id}`;
    if (!matchesAll(key, "connection")) dimConnectionIds.add(c.id);
  }

  return { visibleAssets, visibleConnections, dimAssetIds, dimConnectionIds };
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

