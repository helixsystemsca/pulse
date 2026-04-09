"use client";

import { MapPin } from "lucide-react";
import type { ZoneOut } from "@/lib/setup-api";

const cardBase =
  "rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]";

export function ZoneCard({
  zone,
  gatewayCount,
}: {
  zone: ZoneOut;
  gatewayCount: number;
}) {
  return (
    <div className={cardBase}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ds-secondary text-ds-foreground">
          <MapPin className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ds-foreground">{zone.name}</h3>
          {zone.description ? (
            <p className="mt-1 text-sm text-ds-muted">{zone.description}</p>
          ) : (
            <p className="mt-1 text-sm italic text-ds-muted/80">No description</p>
          )}
        </div>
      </div>
      <div className="mt-4 border-t border-ds-border pt-4 text-sm text-ds-muted">
        <span className="font-medium text-ds-foreground">{gatewayCount}</span> gateway
        {gatewayCount === 1 ? "" : "s"} assigned to this zone
      </div>
    </div>
  );
}
