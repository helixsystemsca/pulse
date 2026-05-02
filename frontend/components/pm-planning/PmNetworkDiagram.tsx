"use client";

import { useMemo, useState } from "react";
import type { PmTask } from "@/lib/pm-planning/types";
import type { CPMResult } from "@/lib/projects/cpm";
import { layoutPoolNetwork } from "@/lib/pm-planning/layoutNetwork";
import { DependencyLine } from "@/components/pm-planning/DependencyLine";
import { NodeCard } from "@/components/pm-planning/NodeCard";

export function PmNetworkDiagram({ tasks, cpm }: { tasks: PmTask[]; cpm: CPMResult }) {
  const { positions, svgWidth, svgHeight } = useMemo(() => layoutPoolNetwork(tasks), [tasks]);
  const [selected, setSelected] = useState<string | null>(null);
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const edges = useMemo(() => {
    const e: { from: string; to: string }[] = [];
    for (const t of tasks) {
      for (const p of t.dependencies) {
        if (byId.has(p)) e.push({ from: p, to: t.id });
      }
    }
    return e;
  }, [tasks, byId]);

  return (
    <div className="flex min-h-[480px] overflow-hidden rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface-secondary)] shadow-[var(--ds-shadow-card)]">
      <div className="min-h-[480px] min-w-0 flex-1 overflow-auto p-3">
        <svg width={svgWidth} height={svgHeight} role="img" aria-label="Task dependency network">
          <defs>
            <marker id="pm-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
              <path d="M0,0 L9,4.5 L0,9 z" fill="var(--ds-text-secondary)" />
            </marker>
          </defs>
          {edges.map((e) => {
            const A = positions.get(e.from);
            const B = positions.get(e.to);
            if (!A || !B) return null;
            const crit = Boolean(cpm.byId[e.from]?.isCritical && cpm.byId[e.to]?.isCritical);
            const x1 = A.x + A.width;
            const y1 = A.y + A.height / 2;
            const x2 = B.x;
            const y2 = B.y + B.height / 2;
            return <DependencyLine key={`${e.from}-${e.to}`} x1={x1} y1={y1} x2={x2} y2={y2} critical={crit} />;
          })}
          {tasks.map((t) => {
            const pos = positions.get(t.id);
            if (!pos) return null;
            const row = cpm.byId[t.id];
            const slack = row?.slack ?? 0;
            const isCrit = row?.isCritical ?? false;
            const floatLabel = isCrit ? "—" : Number.isNaN(slack) ? "—" : `+${slack >= 1 ? Math.round(slack) : slack.toFixed(1)}d`;
            return (
              <foreignObject key={t.id} x={pos.x} y={pos.y} width={pos.width} height={pos.height}>
                <div className="h-full w-full">
                  <NodeCard
                    task={t}
                    isCritical={isCrit}
                    floatLabel={floatLabel}
                    onClick={() => setSelected(t.id)}
                  />
                </div>
              </foreignObject>
            );
          })}
        </svg>
      </div>
      {selected && byId.get(selected) ? (
        <aside
          className="w-80 shrink-0 overflow-y-auto border-l border-[var(--ds-border)] bg-[var(--ds-surface-primary)] p-4"
          aria-label="Task details"
        >
          <p className="text-[10px] font-bold uppercase text-[var(--pm-color-muted)]">Task</p>
          <h3 className="mt-1 text-base font-bold text-[var(--ds-text-primary)]">{byId.get(selected)!.name}</h3>
          <p className="mt-2 font-mono text-sm text-[var(--pm-color-muted)]">{selected}</p>
          <dl className="mt-4 space-y-2 text-sm text-[var(--ds-text-primary)]">
            <div>
              <dt className="text-[var(--pm-color-muted)]">Duration</dt>
              <dd>{byId.get(selected)!.duration}d</dd>
            </div>
            <div>
              <dt className="text-[var(--pm-color-muted)]">Resource</dt>
              <dd>{byId.get(selected)!.resource ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[var(--pm-color-muted)]">Predecessors</dt>
              <dd>{byId.get(selected)!.dependencies.join(", ") || "—"}</dd>
            </div>
            {cpm.byId[selected] ? (
              <div>
                <dt className="text-[var(--pm-color-muted)]">ES / EF (days)</dt>
                <dd>
                  {cpm.byId[selected]!.es.toFixed(2)} → {cpm.byId[selected]!.ef.toFixed(2)}
                </dd>
              </div>
            ) : null}
          </dl>
          <button
            type="button"
            className="mt-4 text-sm font-semibold text-[var(--pm-color-primary)] underline"
            onClick={() => setSelected(null)}
          >
            Close
          </button>
        </aside>
      ) : null}
    </div>
  );
}
