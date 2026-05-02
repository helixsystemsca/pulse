"use client";

import {
  Building2,
  DoorClosed,
  MapPin,
  MousePointer2,
  PenLine,
  Route,
  Spline,
} from "lucide-react";
import type { WorkspaceTool } from "../workspaceTools";

const BTN =
  "flex h-11 w-11 shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-35";

type Item = { tool: WorkspaceTool; label: string; Icon: typeof MousePointer2; disabled?: boolean };

export function MiniToolRail({
  activeTool,
  onToolChange,
  traceAllowed,
  projectReady,
  toolsLocked,
  toolsLockedHint,
}: {
  activeTool: WorkspaceTool;
  onToolChange: (tool: WorkspaceTool) => void;
  traceAllowed: boolean;
  projectReady: boolean;
  toolsLocked: boolean;
  toolsLockedHint: string;
}) {
  const items: Item[] = [
    { tool: "select", label: "Select", Icon: MousePointer2 },
    { tool: "asset", label: "Add asset", Icon: Building2 },
    { tool: "connect", label: "Connect", Icon: Spline },
    { tool: "zone", label: "Zone", Icon: MapPin },
    { tool: "door", label: "Door", Icon: DoorClosed, disabled: true },
    { tool: "annotate", label: "Annotate", Icon: PenLine },
    {
      tool: "trace",
      label: "Trace route",
      Icon: Route,
      disabled: !traceAllowed || !projectReady,
    },
  ];

  return (
    <nav
      className="flex w-14 shrink-0 flex-col divide-y divide-ds-border/50 border-r border-ds-border/80 bg-ds-secondary/30"
      aria-label="Map tools"
    >
      {items.map(({ tool, label, Icon, disabled }) => {
        const on = activeTool === tool;
        const locked = toolsLocked && tool !== "door";
        const effectiveDisabled = Boolean(disabled) || locked;
        const title = locked ? toolsLockedHint : label;
        return (
          <button
            key={tool}
            type="button"
            title={title}
            aria-label={label}
            aria-pressed={on}
            disabled={effectiveDisabled}
            className={`${BTN} ${
              on
                ? "border-l-2 border-l-ds-success bg-ds-primary/50 text-ds-foreground"
                : "border-l-2 border-l-transparent text-ds-muted hover:bg-ds-primary/30 hover:text-ds-foreground"
            }`}
            onClick={() => !effectiveDisabled && onToolChange(tool)}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
