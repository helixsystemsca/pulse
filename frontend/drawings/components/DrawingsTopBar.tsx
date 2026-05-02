"use client";

import { Maximize2, Minimize2, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProjectSelector } from "./ProjectSelector";

const MAP_CATEGORIES = ["General", "Floor plan", "Aerial", "Site", "Other"] as const;

type MapSummary = {
  id: string;
  name: string;
  category: string;
};

export function DrawingsTopBar({
  projectReady,
  mapListLoading,
  uploadBusy,
  activeProjectId,
  setActiveProjectId,
  maps,
  activeMapId,
  onMapChange,
  newMapCategory,
  onNewMapCategoryChange,
  onUploadNewMap,
  onSaveMap,
  saveDisabled,
  fullscreen,
  onEnterFullscreen,
  onExitFullscreen,
}: {
  projectReady: boolean;
  mapListLoading: boolean;
  uploadBusy: boolean;
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  maps: MapSummary[];
  activeMapId: string;
  onMapChange: (id: string) => void;
  newMapCategory: string;
  onNewMapCategoryChange: (c: string) => void;
  onUploadNewMap: () => void;
  onSaveMap: () => void;
  saveDisabled: boolean;
  fullscreen: boolean;
  onEnterFullscreen: () => void;
  onExitFullscreen: () => void;
}) {
  const busy = mapListLoading || uploadBusy;

  const grouped = (() => {
    const m = new Map<string, MapSummary[]>();
    for (const map of maps) {
      const c = map.category?.trim() || "General";
      if (!m.has(c)) m.set(c, []);
      m.get(c)!.push(map);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();

  return (
    <div className="bg-ds-success text-[var(--ds-on-accent)]">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-y-2 border-b border-black/10 px-3 py-2 sm:h-14 sm:flex-nowrap sm:gap-4 sm:py-0 dark:border-white/10">
        <div className="flex min-w-0 w-full flex-1 flex-wrap items-center justify-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
          <div className="min-w-0 flex-1 basis-[min(100%,14rem)] sm:flex-initial sm:basis-auto">
            <ProjectSelector
              variant="inline"
              value={activeProjectId}
              onChange={setActiveProjectId}
              disabled={mapListLoading}
            />
          </div>
          <label className="flex min-w-0 items-center gap-1.5 text-xs">
            <span className="hidden shrink-0 sm:inline">New map category</span>
            <select
              className="app-field h-9 max-w-[10rem] min-w-0 py-0 text-xs"
              value={newMapCategory}
              onChange={(e) => onNewMapCategoryChange(e.target.value)}
              disabled={!projectReady || busy}
              title="Category for the next uploaded map"
            >
              {MAP_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <select
            className="app-field h-9 min-w-0 max-w-[min(100%,22rem)] shrink py-0 text-sm sm:w-[min(100%,20rem)]"
            aria-label="Select map"
            value={activeMapId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__upload__") {
                e.target.value = activeMapId;
                onUploadNewMap();
                return;
              }
              onMapChange(v);
            }}
            disabled={!projectReady || busy}
          >
            <option value="">Select map</option>
            {grouped.map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="__upload__">Upload new image…</option>
          </select>
        </div>

        <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">
          <Button
            type="button"
            variant="secondary"
            surface="light"
            className="h-9 gap-1.5 px-3 text-xs"
            disabled={saveDisabled}
            onClick={onSaveMap}
            title="Save map overlays and layout to the server"
          >
            <Save className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span className="hidden sm:inline">Save</span>
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
