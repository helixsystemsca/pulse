"use client";

import { Hand, MousePointer2, Package, Pentagon } from "lucide-react";
import type { PlannerToolMode } from "@/modules/communications/advertising-mapper/geometry/types";
import { cn } from "@/lib/cn";

const MODES: { id: PlannerToolMode; label: string; shortcut: string; icon: typeof MousePointer2 }[] = [
  { id: "select", label: "Select", shortcut: "V", icon: MousePointer2 },
  { id: "inventory", label: "Inventory", shortcut: "I", icon: Package },
  { id: "constraint", label: "Constraint", shortcut: "C", icon: Pentagon },
  { id: "pan", label: "Pan", shortcut: "H", icon: Hand },
];

type Props = {
  mode: PlannerToolMode;
  onModeChange: (mode: PlannerToolMode) => void;
};

export function PlannerModeToolbar({ mode, onModeChange }: Props) {
  return (
    <ModeBar>
      {MODES.map(({ id, label, shortcut, icon: Icon }) => {
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            title={`${label} (${shortcut})`}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-[var(--ds-accent)] text-white shadow-sm"
                : "text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground",
            )}
            onClick={() => onModeChange(id)}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{label}</span>
            <span className="font-mono text-[10px] opacity-70">{shortcut}</span>
          </button>
        );
      })}
    </ModeBar>
  );
}

function ModeBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-1 border-b border-ds-border/60 bg-ds-secondary/30 px-3 py-1.5">{children}</div>;
}

