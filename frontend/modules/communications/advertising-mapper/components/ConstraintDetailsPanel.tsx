"use client";

import { Trash2 } from "lucide-react";
import { CONSTRAINT_TYPE_OPTIONS, styleForConstraintType } from "@/modules/communications/advertising-mapper/geometry/constraint-styles";
import type { ConstraintRegion, ConstraintType } from "@/modules/communications/advertising-mapper/geometry/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  constraint: ConstraintRegion | null;
  onUpdate: (patch: Partial<ConstraintRegion>) => void;
  onDelete: () => void;
};

export function ConstraintDetailsPanel({ constraint, onUpdate, onDelete }: Props) {
  if (!constraint) {
    return (
      <PanelShell>
        <EmptyState />
      </PanelShell>
    );
  }

  const style = styleForConstraintType(constraint.constraintType);
  const vertexCount = constraint.points.length / 2;

  return (
    <PanelShell>
      <header className="border-b border-ds-border/80 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-ds-foreground">{constraint.label ?? "Constraint region"}</h3>
            <p className="text-[11px] text-ds-muted">{vertexCount} vertices · polygon</p>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
            style={{ backgroundColor: style.fill, color: style.stroke }}
          >
            {style.label}
          </span>
        </div>
      </header>
      <ConstraintForm constraint={constraint} onUpdate={onUpdate} />
      <footer className="border-t border-ds-border/80 p-3">
        <button
          type="button"
          className={cn(buttonVariants({ intent: "secondary", surface: "light" }), "w-full gap-1.5 text-xs text-red-600")}
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete region
        </button>
      </footer>
    </PanelShell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col justify-center p-6 text-center">
      <p className="text-sm font-medium text-ds-foreground">No constraint selected</p>
      <p className="mt-2 text-xs leading-relaxed text-ds-muted">
        Use <strong>Constraint</strong> mode to draw physical regions. Geometry is stored as normalized polygons in wall inches.
      </p>
    </div>
  );
}

function ConstraintForm({
  constraint,
  onUpdate,
}: {
  constraint: ConstraintRegion;
  onUpdate: (patch: Partial<ConstraintRegion>) => void;
}) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 text-sm">
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Constraint type</span>
        <select
          className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
          value={constraint.constraintType}
          onChange={(e) => onUpdate({ constraintType: e.target.value as ConstraintType })}
        >
          {CONSTRAINT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Label</span>
        <input
          className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
          value={constraint.label ?? ""}
          onChange={(e) => onUpdate({ label: e.target.value || undefined })}
        />
      </label>
      <label className="block">
        <span className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Notes</span>
        <textarea
          className="mt-1 min-h-[72px] w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
          value={constraint.notes ?? ""}
          onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
        />
      </label>
    </div>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-ds-border bg-ds-primary/90 shadow-[var(--ds-shadow-card)]">
      {children}
    </div>
  );
}

