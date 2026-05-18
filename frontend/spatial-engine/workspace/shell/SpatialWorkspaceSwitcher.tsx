"use client";

import { cn } from "@/lib/cn";
import type { SpatialWorkspaceDefinition, SpatialWorkspaceId } from "@/spatial-engine/workspace/types";

export type SpatialWorkspaceSwitcherProps = {
  workspaces: readonly SpatialWorkspaceDefinition[];
  activeId: SpatialWorkspaceId | null;
  onChange: (id: SpatialWorkspaceId) => void;
  className?: string;
};

export function SpatialWorkspaceSwitcher({
  workspaces,
  activeId,
  onChange,
  className,
}: SpatialWorkspaceSwitcherProps) {
  if (workspaces.length <= 1) return null;

  return (
    <nav
      className={cn("flex items-center gap-1 rounded-lg border border-ds-border/80 bg-ds-secondary/30 p-0.5", className)}
      aria-label="Spatial workspace"
    >
      {workspaces.map((ws) => {
        const active = ws.id === activeId;
        const comingSoon = ws.status === "coming_soon";
        return (
          <button
            key={ws.id}
            type="button"
            disabled={comingSoon}
            title={comingSoon ? `${ws.label} — coming soon` : ws.description}
            onClick={() => onChange(ws.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-ds-primary text-ds-foreground shadow-sm"
                : "text-ds-muted hover:bg-ds-primary/60 hover:text-ds-foreground",
              comingSoon && "cursor-not-allowed opacity-50",
            )}
            aria-current={active ? "page" : undefined}
          >
            {ws.label}
            {comingSoon ? (
              <span className="ml-1.5 text-[9px] font-normal uppercase tracking-wide text-ds-muted">Soon</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
