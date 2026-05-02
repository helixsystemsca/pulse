"use client";

import { Camera, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProjectSelector } from "./ProjectSelector";

type BlueprintOption = { id: string; name: string };

export function DrawingsTopBar({
  projectReady,
  bpLoading,
  activeProjectId,
  setActiveProjectId,
  blueprints,
  selectedBlueprintId,
  setSelectedBlueprintId,
  onSnapshot,
  fullscreen,
  onEnterFullscreen,
  onExitFullscreen,
}: {
  projectReady: boolean;
  bpLoading: boolean;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  blueprints: BlueprintOption[];
  selectedBlueprintId: string;
  setSelectedBlueprintId: (id: string) => void;
  onSnapshot: () => void;
  fullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
}) {
  return (
    <div className="bg-ds-success text-[var(--ds-on-accent)]">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-y-2 border-b border-black/10 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:py-0 dark:border-white/10">
        <div className="flex min-w-0 w-full flex-1 flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
          <div className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:flex-initial sm:basis-auto">
            <ProjectSelector
              variant="inline"
              value={activeProjectId}
              onChange={setActiveProjectId}
              disabled={bpLoading}
            />
          </div>
          <select
            className="app-field h-9 min-h-0 min-w-0 w-full max-w-[min(100%,20rem)] shrink py-0 text-sm sm:w-[min(100%,18rem)]"
            value={selectedBlueprintId}
            onChange={(e) => setSelectedBlueprintId(e.target.value)}
            disabled={!projectReady || bpLoading || blueprints.length === 0}
          >
            {blueprints.length === 0 ? <option value="">No blueprints yet</option> : null}
            {blueprints.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
          <Button
            type="button"
            variant="secondary"
            surface="light"
            className="h-9 gap-1.5 px-3 text-xs"
            onClick={onSnapshot}
            title="Placeholder — future versioned snapshots"
          >
            <Camera className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="hidden sm:inline">Save snapshot</span>
          </Button>
          {fullscreen ? (
            <Button
              type="button"
              variant="secondary"
              surface="light"
              className="h-9 gap-1.5 px-3 text-xs"
              onClick={onExitFullscreen}
              title="Return to Drawings"
            >
              <Minimize2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="hidden sm:inline">Exit</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              surface="light"
              className="h-9 gap-1.5 px-3 text-xs"
              onClick={onEnterFullscreen}
              title="Open fullscreen editor"
            >
              <Maximize2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="hidden sm:inline">Fullscreen</span>
            </Button>
          )}
        </div>
      </header>
    </div>
  );
}
