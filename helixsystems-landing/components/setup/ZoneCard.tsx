"use client";

import { MapPin } from "lucide-react";
import type { ZoneOut } from "@/lib/setup-api";

const cardBase =
  "rounded-md border border-slate-200/80 bg-white p-5 shadow-card dark:border-[#374151] dark:bg-[#111827]";

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
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-900">
          <MapPin className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-pulse-navy">{zone.name}</h3>
          {zone.description ? (
            <p className="mt-1 text-sm text-pulse-muted">{zone.description}</p>
          ) : (
            <p className="mt-1 text-sm italic text-pulse-muted/80">No description</p>
          )}
        </div>
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-pulse-muted">
        <span className="font-medium text-pulse-navy">{gatewayCount}</span> gateway
        {gatewayCount === 1 ? "" : "s"} assigned to this zone
      </div>
    </div>
  );
}
