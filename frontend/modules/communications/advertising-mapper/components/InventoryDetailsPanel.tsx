"use client";

import { ChevronDown, FileText, MoreHorizontal } from "lucide-react";
import { ExpiringSoonBadge, isExpiringSoon, StatusBadge } from "@/components/communications/StatusBadge";
import { formatMeasurement, squareFeetFromInches } from "@/modules/communications/advertising-mapper/lib/measurements";
import { computeInventoryPricing } from "@/modules/communications/advertising-mapper/lib/pricing";
import type { InventoryBlock, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  block: InventoryBlock | null;
  unit: MeasurementUnit;
  onUpdate: (patch: Partial<InventoryBlock>) => void;
};

export function InventoryDetailsPanel({ block, unit, onUpdate }: Props) {
  if (!block) {
    return (
      <div className="flex h-full min-h-[320px] flex-col justify-center rounded-2xl border border-ds-border bg-ds-primary/90 p-6 text-center shadow-[var(--ds-shadow-card)]">
        <p className="text-sm font-medium text-ds-foreground">No inventory selected</p>
        <p className="mt-2 text-xs leading-relaxed text-ds-muted">
          Select a signage block on the wall planner to view dimensions, pricing, and contract details.
        </p>
      </div>
    );
  }

  const sqFt = squareFeetFromInches(block.width_inches, block.height_inches);
  const pricing = computeInventoryPricing(block);

  return (
    <div className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-2xl border border-ds-border bg-ds-primary/90 shadow-[var(--ds-shadow-card)]">
      <div className="border-b border-ds-border/80 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-ds-foreground">{block.name}</h3>
            <p className="text-[11px] text-ds-muted">{block.inventoryId ?? block.id}</p>
          </div>
          <StatusBadge variant="ad" status={block.status} size="md" />
        </div>
        {block.status === "occupied" && isExpiringSoon(block.expiryDate) ? (
          <div className="mt-2">
            <ExpiringSoonBadge />
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <section className="space-y-3 text-sm">
          <DetailRow label="Dimensions">
            {formatMeasurement(block.width_inches, unit)} × {formatMeasurement(block.height_inches, unit)}
          </DetailRow>
          <DetailRow label="Area">{sqFt.toFixed(1)} sq ft</DetailRow>
          <DetailRow label="Zone">{block.zone ?? "—"}</DetailRow>
          <DetailRow label="Mounting">{block.mountingType ?? "—"}</DetailRow>
          <DetailRow label="Visibility tier">
            <span className="rounded-full bg-ds-secondary px-2 py-0.5 text-xs font-semibold capitalize">
              {block.visibilityTier ?? "standard"}
            </span>
          </DetailRow>
        </section>

        <section className="mt-5 border-t border-ds-border/80 pt-4">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Commercial pricing</h4>
          <ul className="mt-2 space-y-1.5">
            {pricing.lines.map((line) => (
              <li key={line.key} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ds-muted">{line.label}</span>
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    line.emphasis === "total" && "font-bold text-[var(--ds-accent)]",
                    line.emphasis === "discount" && "text-red-500",
                  )}
                >
                  {line.emphasis === "normal" && line.key.includes("multiplier")
                    ? `${line.amount.toFixed(2)}×`
                    : formatMoney(line.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 border-t border-ds-border/80 pt-4">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Contract</h4>
          <DetailRow label="Sponsor">{block.sponsor ?? "—"}</DetailRow>
          <DetailRow label="Expiry">
            {block.expiryDate ? new Date(block.expiryDate).toLocaleDateString() : "—"}
          </DetailRow>
          <label className="mt-2 block text-[11px] font-bold uppercase tracking-wide text-ds-muted">Status</label>
          <select
            className="mt-1 w-full rounded-lg border border-ds-border bg-ds-primary px-3 py-2 text-sm"
            value={block.status}
            onChange={(e) => onUpdate({ status: e.target.value as InventoryBlock["status"] })}
          >
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="occupied">Occupied</option>
            <option value="expired">Expired</option>
          </select>
        </section>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-ds-border/80 p-3">
        <button type="button" className={cn(buttonVariants({ intent: "primary", surface: "light" }), "flex-1 text-xs")}>
          Reserve
        </button>
        <button type="button" className={cn(buttonVariants({ intent: "secondary", surface: "light" }), "flex-1 gap-1 text-xs")}>
          <FileText className="h-3.5 w-3.5" />
          Create proposal
        </button>
        <button type="button" className={cn(buttonVariants({ intent: "secondary", surface: "light" }), "px-2")} aria-label="More actions">
          <MoreHorizontal className="h-4 w-4" />
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-ds-muted">{label}</span>
      <span className="font-medium text-ds-foreground">{children}</span>
    </div>
  );
}

function formatMoney(amount: number): string {
  if (amount < 0) return `-$${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (amount > 0 && amount < 10 && !Number.isInteger(amount)) return `${amount.toFixed(2)}×`;
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
