"use client";

import { Link2, Wrench } from "lucide-react";
import type { EquipmentOut } from "@/lib/setup-api";

const cardBase =
  "rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]";

export function EquipmentCard({
  equipment,
  linkedLabel,
  onLinkBle,
}: {
  equipment: EquipmentOut;
  linkedLabel: string | null;
  onLinkBle?: () => void;
}) {
  const linked = Boolean(linkedLabel);
  return (
    <div className={cardBase}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-900">
          <Wrench className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-pulse-navy">{equipment.name}</h3>
          <p className="mt-0.5 font-mono text-xs text-pulse-muted">{equipment.tag_id}</p>
          <p className="mt-2 text-xs capitalize text-pulse-muted">Status: {equipment.status}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            linked
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
              : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80"
          }`}
        >
          {linked ? "Linked" : "Not linked"}
        </span>
      </div>
      <div className="mt-4 border-t border-slate-100 pt-4 text-sm text-pulse-muted">
        {linked ? (
          <p>
            <span className="font-medium text-pulse-navy">BLE tag:</span> {linkedLabel}
          </p>
        ) : (
          <p>No equipment tag paired. Pair a tag to track this asset indoors.</p>
        )}
        {onLinkBle ? (
          <button
            type="button"
            onClick={onLinkBle}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#2B4C7E] hover:underline"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden />
            {linked ? "Change tag" : "Link BLE tag"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
