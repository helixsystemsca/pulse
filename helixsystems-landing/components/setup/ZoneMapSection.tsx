"use client";

import { MapPin } from "lucide-react";
import type { GatewayOut, ZoneOut } from "@/lib/setup-api";

/**
 * MVP “map”: same card grid as the rest of setup — zones as rows with gateway placement.
 * Replace with a canvas/geo map later without changing parent layout.
 */
export function ZoneMapSection({
  zones,
  gateways,
  tagCount,
  assignedTagCount,
}: {
  zones: ZoneOut[];
  gateways: GatewayOut[];
  /** Fleet-wide tag counts (BLE has no zone_id until RTLS ties tags to coverage). */
  tagCount: number;
  assignedTagCount: number;
}) {
  return (
    <section className="rounded-md border border-slate-200/80 bg-white/90 p-5 shadow-card md:p-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-[#2B4C7E]" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-pulse-navy">Zone map</h2>
          <p className="text-sm text-pulse-muted">
            Physical coverage areas and gateway placement. Fleet: {tagCount} tag{tagCount === 1 ? "" : "s"} registered
            {tagCount ? ` (${assignedTagCount} assigned)` : ""}.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="hidden rounded-lg bg-slate-50/90 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-pulse-muted md:grid md:grid-cols-[1fr_1.2fr_auto] md:gap-3">
          <span>Zone</span>
          <span>Gateways in zone</span>
          <span className="text-right">Gateways</span>
        </div>
        {zones.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 bg-white/60 px-4 py-6 text-pulse-muted">
            Create zones to see them on this map. Gateways you assign to a zone appear in the middle column.
          </p>
        ) : (
          zones.map((z) => {
            const gws = gateways.filter((g) => g.zone_id === z.id);
            return (
              <div
                key={z.id}
                className="grid gap-2 rounded-md border border-slate-200/80 bg-slate-50/50 p-4 md:grid-cols-[1fr_1.2fr_auto] md:items-center md:gap-3"
              >
                <div>
                  <p className="font-semibold text-pulse-navy">{z.name}</p>
                  {z.description ? <p className="text-xs text-pulse-muted">{z.description}</p> : null}
                </div>
                <div className="text-pulse-muted">
                  {gws.length ? (
                    <ul className="list-inside list-disc text-sm text-pulse-navy">
                      {gws.map((g) => (
                        <li key={g.id}>
                          <span className="font-medium">{g.name}</span>
                          <span className="ml-1 font-mono text-xs text-pulse-muted">{g.identifier}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm italic">No gateways assigned — assign from gateway card</span>
                  )}
                </div>
                <div className="text-right text-xs text-pulse-muted md:border-l md:border-slate-200/80 md:pl-3">
                  <span className="block font-semibold text-pulse-navy">{gws.length}</span>
                  <span>in this zone</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-pulse-muted">
        Visual floorplan editor can plug in here later — layout stays in this section.
      </p>
    </section>
  );
}
