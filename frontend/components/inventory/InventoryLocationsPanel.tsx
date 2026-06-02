"use client";

import { useState } from "react";
import { createZone, deleteZone, patchZone } from "@/lib/setup-api";
import { filterInventoryStorageZones, isScheduleFacilityZone } from "@/lib/inventory/inventory-zones";
import { invalidateReferenceCache } from "@/lib/api-reference-cache";
import { fetchPulseZonesCached, type PulseZoneOpt } from "@/lib/pulse/pulse-reference-data";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25 dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";
const PRIMARY_BTN = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-bold");
const SECONDARY_BTN = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "px-3 py-1.5 text-xs font-semibold",
);

type Props = {
  companyId: string | null;
  zones: PulseZoneOpt[];
  onZonesChange: (zones: PulseZoneOpt[]) => void;
  canManage: boolean;
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onError?: (message: string | null) => void;
};

async function reloadZones(onZonesChange: (zones: PulseZoneOpt[]) => void) {
  invalidateReferenceCache("pulse:zones");
  const next = await fetchPulseZonesCached();
  onZonesChange(next);
}

export function InventoryLocationsPanel({
  companyId,
  zones,
  onZonesChange,
  canManage,
  busy,
  onBusyChange,
  onError,
}: Props) {
  const [newName, setNewName] = useState("");
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});

  async function run<T>(fn: () => Promise<T>) {
    onBusyChange?.(true);
    onError?.(null);
    try {
      return await fn();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Could not update locations");
      return undefined;
    } finally {
      onBusyChange?.(false);
    }
  }

  async function addLocation() {
    const name = newName.trim();
    if (!name || !canManage) return;
    await run(async () => {
      await createZone(companyId, { name });
      setNewName("");
      await reloadZones(onZonesChange);
    });
  }

  async function saveName(zoneId: string) {
    const name = (nameDrafts[zoneId] ?? zones.find((z) => z.id === zoneId)?.name ?? "").trim();
    if (!name || !canManage) return;
    await run(async () => {
      await patchZone(companyId, zoneId, { name });
      setNameDrafts((prev) => {
        const next = { ...prev };
        delete next[zoneId];
        return next;
      });
      await reloadZones(onZonesChange);
    });
  }

  const storageZones = filterInventoryStorageZones(zones);

  async function removeLocation(zoneId: string) {
    if (!canManage) return;
    const z = zones.find((x) => x.id === zoneId);
    if (!z) return;
    if (isScheduleFacilityZone(z)) {
      onError?.("Schedule facilities are managed under Organization → Schedule, not inventory locations.");
      return;
    }
    if (!window.confirm(`Remove location “${z.name}”? Items at this location will be cleared.`)) return;
    await run(async () => {
      await deleteZone(companyId, zoneId);
      await reloadZones(onZonesChange);
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-pulse-muted">
        Storage locations appear when registering items, filtering the list, and on item details. Schedule facilities
        (e.g. Facility 1 for workforce planning) are managed separately and are not listed here.
      </p>
      {!canManage ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Adding or editing locations requires Manage inventory permission or facility location roles in Workers →
          Access policy. You can still pick from existing locations below.
        </p>
      ) : null}
      {canManage ? (
        <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-4 dark:border-ds-border dark:bg-ds-secondary/60">
          <label className={LABEL} htmlFor="inv-new-location">
            Add location
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
            <input
              id="inv-new-location"
              className={FIELD}
              value={newName}
              disabled={busy}
              placeholder="e.g. Tool crib — Building A"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addLocation();
                }
              }}
            />
            <button type="button" className={PRIMARY_BTN} disabled={busy || !newName.trim()} onClick={() => void addLocation()}>
              Add
            </button>
          </div>
        </div>
      ) : null}
      <div className="space-y-3">
        <h3 className={LABEL}>Existing locations</h3>
        {storageZones.length === 0 ? (
          <p className="text-sm text-pulse-muted">No locations yet.{canManage ? " Add one above." : ""}</p>
        ) : (
          storageZones.map((z) => {
            const draft = nameDrafts[z.id] ?? z.name;
            const dirty = draft.trim() !== z.name;
            return (
              <div
                key={z.id}
                className="flex flex-col gap-2 rounded-lg border border-slate-200/90 bg-white p-3 sm:flex-row sm:items-end dark:border-ds-border dark:bg-ds-primary"
              >
                <div className="min-w-0 flex-1">
                  <label className={LABEL} htmlFor={`inv-loc-${z.id}`}>
                    Name
                  </label>
                  {canManage ? (
                    <input
                      id={`inv-loc-${z.id}`}
                      className={FIELD}
                      value={draft}
                      disabled={busy}
                      onChange={(e) => setNameDrafts((prev) => ({ ...prev, [z.id]: e.target.value }))}
                    />
                  ) : (
                    <p className="mt-1 text-sm font-medium text-pulse-navy dark:text-gray-100">{z.name}</p>
                  )}
                </div>
                {canManage ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={PRIMARY_BTN}
                      disabled={busy || !dirty || !draft.trim()}
                      onClick={() => void saveName(z.id)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className={SECONDARY_BTN}
                      disabled={busy}
                      onClick={() => void removeLocation(z.id)}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
