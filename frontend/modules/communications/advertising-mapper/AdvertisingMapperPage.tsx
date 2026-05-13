"use client";

import { useCallback, useMemo, useState } from "react";
import { CommunicationsModuleShell } from "@/components/communications/CommunicationsModuleShell";
import { CommunicationsPanel } from "@/components/communications/CommunicationsPanel";
import { FacilityCanvas } from "@/components/communications/FacilityCanvas";
import { AssetPreviewCard } from "@/components/communications/AssetPreviewCard";
import { ExpiringSoonBadge, isExpiringSoon, StatusBadge } from "@/components/communications/StatusBadge";
import { MOCK_FACILITY_WALLS } from "@/modules/communications/mock-data";
import type { AdSlot, FacilityWallLayout } from "@/modules/communications/types";

function cloneWalls(): FacilityWallLayout[] {
  return JSON.parse(JSON.stringify(MOCK_FACILITY_WALLS)) as FacilityWallLayout[];
}

export function AdvertisingMapperPage() {
  const [walls, setWalls] = useState<FacilityWallLayout[]>(() => cloneWalls());
  const [wallId, setWallId] = useState(MOCK_FACILITY_WALLS[0]!.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const wall = useMemo(() => walls.find((w) => w.id === wallId) ?? walls[0]!, [walls, wallId]);
  const selected = useMemo(() => wall.slots.find((s) => s.id === selectedId) ?? null, [wall.slots, selectedId]);

  const onSlotMove = useCallback((id: string, patch: Pick<AdSlot, "x" | "y">) => {
    setWalls((prev) =>
      prev.map((w) =>
        w.id !== wallId
          ? w
          : {
              ...w,
              slots: w.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)),
            },
      ),
    );
  }, [wallId]);

  const updateSelected = useCallback(
    (patch: Partial<AdSlot>) => {
      if (!selectedId) return;
      setWalls((prev) =>
        prev.map((w) =>
          w.id !== wallId
            ? w
            : {
                ...w,
                slots: w.slots.map((s) => (s.id === selectedId ? { ...s, ...patch } : s)),
              },
        ),
      );
    },
    [selectedId, wallId],
  );

  return (
    <CommunicationsModuleShell
      title="Arena wall advertising mapper"
      description="Visual inventory of arena and lobby placements — foundation for sponsor contracts, print proofs, and analytics."
    >
      <div className="grid min-h-[560px] gap-4 xl:grid-cols-[240px_1fr_300px]">
        <CommunicationsPanel
          title="Layouts & assets"
          description="Tooling for sponsor kits and scale references."
          tone="muted"
          className="min-h-[320px]"
        >
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-wide text-ds-muted">Wall layout</label>
            <select
              className="w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground"
              value={wallId}
              onChange={(e) => {
                setWallId(e.target.value);
                setSelectedId(null);
              }}
            >
              {walls.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-ds-muted">
              Future: import CAD / PDF overlays, versioned layouts, and sponsor contract links per wall revision.
            </p>
            <div className="mt-4 space-y-2 border-t border-ds-border/80 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Asset drop (preview)</p>
              <div className="rounded-xl border border-dashed border-ds-border bg-ds-secondary/30 p-4 text-center text-xs text-ds-muted transition-colors hover:border-[var(--ds-accent)]/40">
                Drag sponsor artwork here (Supabase storage wiring later).
              </div>
            </div>
          </div>
        </CommunicationsPanel>

        <div className="flex min-h-[320px] flex-col rounded-2xl border border-ds-border bg-ds-primary/90 p-4 shadow-[var(--ds-shadow-card)]">
          <FacilityCanvas
            wallName={wall.name}
            aspectRatio={wall.aspectRatio}
            slots={wall.slots}
            selectedId={selectedId}
            onSelect={setSelectedId}
            zoom={zoom}
            onZoomChange={setZoom}
            onSlotMove={onSlotMove}
            className="min-h-0 flex-1"
          />
        </div>

        <CommunicationsPanel title="Slot details" description="Selection drives export and contract rows later." className="min-h-[320px]">
          {selected ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge variant="ad" status={selected.status} size="md" />
                {selected.status === "occupied" && isExpiringSoon(selected.expiryDate) ? <ExpiringSoonBadge /> : null}
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Name</label>
                <input
                  className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                  value={selected.name}
                  onChange={(e) => updateSelected({ name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">W %</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 text-sm"
                    value={Math.round(selected.width)}
                    onChange={(e) => updateSelected({ width: Number(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">H %</label>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-2 py-1.5 text-sm"
                    value={Math.round(selected.height)}
                    onChange={(e) => updateSelected({ height: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Sponsor</label>
                <input
                  className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                  value={selected.sponsorName ?? ""}
                  placeholder="—"
                  onChange={(e) => updateSelected({ sponsorName: e.target.value || undefined })}
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Status</label>
                <select
                  className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                  value={selected.status}
                  onChange={(e) => updateSelected({ status: e.target.value as AdSlot["status"] })}
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                  <option value="occupied">Occupied</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Expiry</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
                  value={selected.expiryDate?.slice(0, 10) ?? ""}
                  onChange={(e) => updateSelected({ expiryDate: e.target.value ? `${e.target.value}T12:00:00.000Z` : undefined })}
                />
              </div>
              <AssetPreviewCard title="Sponsor creative" subtitle="Signed URL + crop meta (future)" className="mt-2" />
            </div>
          ) : (
            <p className="text-sm text-ds-muted">Select a slot on the canvas to edit details and attach assets.</p>
          )}
        </CommunicationsPanel>
      </div>
    </CommunicationsModuleShell>
  );
}
