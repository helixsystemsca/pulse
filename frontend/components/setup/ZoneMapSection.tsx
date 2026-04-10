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
    <section className="rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)] md:p-6">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-ds-foreground" aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-ds-foreground">Zone map</h2>
          <p className="text-sm text-ds-muted">
            Physical coverage areas and gateway placement. Fleet: {tagCount} tag{tagCount === 1 ? "" : "s"} registered
            {tagCount ? ` (${assignedTagCount} assigned)` : ""}.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm">
        <div className="hidden rounded-lg bg-ds-secondary/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-ds-muted md:grid md:grid-cols-[1fr_1.2fr_auto] md:gap-3">
          <span>Zone</span>
          <span>Gateways in zone</span>
          <span className="text-right">Gateways</span>
        </div>
        {zones.length === 0 ? (
          <p className="rounded-md border border-dashed border-ds-border bg-ds-secondary/60 px-4 py-6 text-ds-muted">
            Create zones to see them on this map. Gateways you assign to a zone appear in the middle column.
          </p>
        ) : (
          zones.map((z) => {
            const gws = gateways.filter((g) => g.zone_id === z.id);
            return (
              <div
                key={z.id}
                className="grid gap-2 rounded-md border border-ds-border bg-ds-secondary/40 p-4 md:grid-cols-[1fr_1.2fr_auto] md:items-center md:gap-3"
              >
                <div>
                  <p className="font-semibold text-ds-foreground">{z.name}</p>
                  {z.description ? <p className="text-xs text-ds-muted">{z.description}</p> : null}
                </div>
                <div className="text-ds-muted">
                  {gws.length ? (
                    <ul className="list-inside list-disc text-sm text-ds-foreground">
                      {gws.map((g) => (
                        <li key={g.id}>
                          <span className="font-medium">{g.name}</span>
                          <span className="ml-1 font-mono text-xs text-ds-muted">{g.identifier}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm italic">No gateways assigned — assign from gateway card</span>
                  )}
                </div>
                <div className="text-right text-xs text-ds-muted md:border-l md:border-ds-border md:pl-3">
                  <span className="block font-semibold text-ds-foreground">{gws.length}</span>
                  <span>in this zone</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-4 text-center text-[11px] text-ds-muted">
        Visual floorplan editor can plug in here later — layout stays in this section.
      </p>
    </section>
  );
}
