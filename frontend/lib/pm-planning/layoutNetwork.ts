import type { PmTask } from "@/lib/pm-planning/types";

export type NetworkNodeRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Layered DAG layout (left → right). */
export function layoutPoolNetwork(tasks: PmTask[]): {
  positions: Map<string, NetworkNodeRect>;
  svgWidth: number;
  svgHeight: number;
  layerIndex: Record<string, number>;
} {
  /** Compact nodes with wider gaps so dependency lines cross less and the graph is easier to scan. */
  const nodeW = 176;
  const nodeH = 76;
  const hGap = 100;
  const vGap = 44;

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const t of tasks) {
    preds.set(
      t.id,
      t.dependencies.filter((d) => byId.has(d)),
    );
    succs.set(t.id, []);
  }
  for (const t of tasks) {
    for (const p of preds.get(t.id) ?? []) {
      succs.get(p)!.push(t.id);
    }
  }

  const indeg = new Map<string, number>();
  for (const t of tasks) indeg.set(t.id, preds.get(t.id)?.length ?? 0);
  const q: string[] = [];
  for (const t of tasks) if ((indeg.get(t.id) ?? 0) === 0) q.push(t.id);
  const topo: string[] = [];
  while (q.length) {
    const u = q.shift()!;
    topo.push(u);
    for (const v of succs.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 0) - 1);
      if (indeg.get(v) === 0) q.push(v);
    }
  }

  const layerIndex: Record<string, number> = {};
  for (const id of topo) {
    const ps = preds.get(id) ?? [];
    layerIndex[id] = ps.length === 0 ? 0 : Math.max(...ps.map((p) => layerIndex[p] ?? 0)) + 1;
  }

  const maxL = Math.max(0, ...Object.values(layerIndex));
  const byLayer = new Map<number, string[]>();
  for (let L = 0; L <= maxL; L++) byLayer.set(L, []);
  for (const t of tasks) {
    const L = layerIndex[t.id] ?? 0;
    byLayer.get(L)!.push(t.id);
  }
  for (let L = 0; L <= maxL; L++) {
    byLayer.get(L)!.sort((a, b) => a.localeCompare(b));
  }

  const positions = new Map<string, NetworkNodeRect>();
  let maxY = 0;
  for (let L = 0; L <= maxL; L++) {
    const ids = byLayer.get(L) ?? [];
    ids.forEach((id, idx) => {
      const x = 40 + L * (nodeW + hGap);
      const y = 40 + idx * (nodeH + vGap);
      positions.set(id, { id, x, y, width: nodeW, height: nodeH });
      maxY = Math.max(maxY, y + nodeH);
    });
  }

  const svgWidth = 40 + (maxL + 1) * (nodeW + hGap) + 40;
  const svgHeight = maxY + 56;

  return { positions, svgWidth, svgHeight, layerIndex };
}
