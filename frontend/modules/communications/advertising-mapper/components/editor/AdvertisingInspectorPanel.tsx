"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search, Trash2 } from "lucide-react";
import { StatusBadge } from "@/components/communications/StatusBadge";
import { InventoryDetailsPanel } from "@/modules/communications/advertising-mapper/components/InventoryDetailsPanel";
import {
  computeAvailableOpportunity,
  computeCampaignPricing,
} from "@/modules/communications/advertising-mapper/lib/campaign-pricing";
import { computeInventoryPricing } from "@/modules/communications/advertising-mapper/lib/pricing";
import { formatMeasurement, squareFeetFromInches } from "@/modules/communications/advertising-mapper/lib/measurements";
import {
  contractStructureLabel,
  formatLocation,
  isAvailablePlot,
  isCurrentInventory,
} from "@/modules/communications/advertising-mapper/lib/inventory-rail";
import { presetLabel } from "@/modules/communications/advertising-mapper/lib/standard-ad-sizes";
import type { FacilityWallPlan, InventoryBlock, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

/** Right rail tabs — replaces legacy Inventory / Properties / Layers. */
type RailTab = "current" | "available";

export type AdvertisingLayerVisibility = {
  backdrop: boolean;
  constraints: boolean;
  inventory: boolean;
};

type Props = {
  wall: FacilityWallPlan;
  unit: MeasurementUnit;
  selectedInventoryId: string | null;
  onSelectInventory: (id: string) => void;
  onBlockChange: (id: string, patch: Partial<InventoryBlock>) => void;
  onBlockDelete: (id: string) => void;
};

export function AdvertisingInspectorPanel({
  wall,
  unit,
  selectedInventoryId,
  onSelectInventory,
  onBlockChange,
  onBlockDelete,
}: Props) {
  const [tab, setTab] = useState<RailTab>("current");
  const [query, setQuery] = useState("");

  const selectedBlock = useMemo(
    () => wall.blocks.find((b) => b.id === selectedInventoryId) ?? null,
    [wall.blocks, selectedInventoryId],
  );

  const currentBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wall.blocks
      .filter(isCurrentInventory)
      .filter((b) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          (b.inventoryId?.toLowerCase().includes(q) ?? false) ||
          (b.sponsor?.toLowerCase().includes(q) ?? false) ||
          (b.contactName?.toLowerCase().includes(q) ?? false)
        );
      });
  }, [query, wall.blocks]);

  const availablePlots = useMemo(() => {
    const q = query.trim().toLowerCase();
    return wall.blocks
      .filter(isAvailablePlot)
      .filter((b) => {
        if (!q) return true;
        return (
          b.name.toLowerCase().includes(q) ||
          (b.inventoryId?.toLowerCase().includes(q) ?? false) ||
          formatLocation(b, wall.name).toLowerCase().includes(q)
        );
      });
  }, [query, wall.blocks, wall.name]);

  const currentRevenue = useMemo(() => computeCampaignPricing(wall.blocks), [wall.blocks]);
  const availableOpportunity = useMemo(() => computeAvailableOpportunity(wall.blocks), [wall.blocks]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-white" data-ad-rail="current-available">
      <div
        className="grid shrink-0 grid-cols-2 gap-0 border-b border-slate-200 bg-slate-50/80 p-1"
        role="tablist"
        aria-label="Ad inventory"
      >
        <RailTabButton active={tab === "current"} onClick={() => setTab("current")}>
          Current
        </RailTabButton>
        <RailTabButton active={tab === "available"} onClick={() => setTab("available")}>
          Available
        </RailTabButton>
      </div>

      <div className="shrink-0 border-b border-slate-100 p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder={tab === "current" ? "Search current ads…" : "Search available plots…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-800 shadow-sm placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "current" ? (
          <div className="space-y-2 p-2">
            {currentBlocks.map((block) => (
              <CurrentAdCard
                key={block.id}
                block={block}
                wallName={wall.name}
                unit={unit}
                selected={block.id === selectedInventoryId}
                onSelect={() => onSelectInventory(block.id)}
                onDelete={() => onBlockDelete(block.id)}
              />
            ))}
            {currentBlocks.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No active ads on this wall. Use <strong>Snip ad</strong> (S) on the photo to add cards from existing
                signage.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {availablePlots.map((block) => (
              <AvailablePlotCard
                key={block.id}
                block={block}
                wallName={wall.name}
                unit={unit}
                selected={block.id === selectedInventoryId}
                onSelect={() => onSelectInventory(block.id)}
                onDelete={() => onBlockDelete(block.id)}
              />
            ))}
            {availablePlots.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">
                No open plots. Use <strong>Inventory</strong> (I) on the canvas or extend empty plot space in the footer.
              </p>
            ) : null}
          </div>
        )}
      </div>

      {selectedBlock ? (
        <div className="max-h-[38%] shrink-0 overflow-y-auto border-t border-slate-200 bg-slate-50/60">
          <InventoryDetailsPanel
            block={selectedBlock}
            unit={unit}
            onUpdate={(patch) => {
              if (selectedInventoryId) onBlockChange(selectedInventoryId, patch);
            }}
          />
        </div>
      ) : null}

      {tab === "current" ? (
        <RevenueFooter
          title="Revenue summary"
          lines={currentRevenue.lines}
          highlightKey="monthly"
          actions
        />
      ) : (
        <RevenueFooter
          title="Missed revenue"
          lines={availableOpportunity.lines}
          highlightKey="monthly"
          tone="missed"
        />
      )}
    </div>
  );
}

function RailTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "rounded-md px-3 py-2 text-xs font-semibold transition-colors",
        active
          ? "bg-white text-sky-800 shadow-sm ring-1 ring-slate-200/90"
          : "text-slate-500 hover:bg-white/60 hover:text-slate-800",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function CardDeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ intent: "secondary", surface: "light" }),
        "inline-flex h-7 w-7 shrink-0 items-center justify-center p-0 text-red-600 hover:border-red-200 hover:bg-red-50",
      )}
      aria-label={`Delete ${label}`}
      title={`Delete ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onDelete();
      }}
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function CurrentAdCard({
  block,
  wallName,
  unit,
  selected,
  onSelect,
  onDelete,
}: {
  block: InventoryBlock;
  wallName: string;
  unit: MeasurementUnit;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const pricing = computeInventoryPricing(block);
  const dims = `${formatMeasurement(block.width_inches, unit)} × ${formatMeasurement(block.height_inches, unit)}`;
  const location = formatLocation(block, wallName);
  const contact = block.contactName ?? block.sponsor ?? "—";
  const expiry = block.expiryDate ? new Date(block.expiryDate).toLocaleDateString() : "—";

  const cardLabel = block.inventoryId ?? block.name;

  return (
    <div
      className={cn(
        "w-full rounded-xl border p-2.5 text-left transition-colors",
        selected ? "border-sky-400 bg-sky-50/90 ring-1 ring-sky-200" : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <div className="flex gap-2.5">
        <button type="button" onClick={onSelect} className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500">
          <AdThumb assetUrl={block.assetUrl} label={block.name} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-bold text-slate-800">{block.inventoryId ?? block.id}</p>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              <StatusBadge variant="ad" status={block.status} size="sm" />
              <CardDeleteButton label={cardLabel} onDelete={onDelete} />
            </div>
          </div>
          <button type="button" onClick={onSelect} className="w-full text-left">
          <p className="truncate text-[11px] text-slate-600">{block.sponsor ?? block.name}</p>
          <dl className="mt-2 space-y-0.5 text-[10px] text-slate-500">
            <Row label="Location" value={location} />
            <Row label="Size" value={`${presetLabel(block.sizePreset)} · ${dims}`} />
            <Row label="Contact" value={contact} />
            <Row label="Contract" value={contractStructureLabel(block.contractStructure)} />
            <Row label="Expires" value={expiry} />
          </dl>
            <p className="mt-1.5 text-xs font-semibold text-emerald-700">
              ${pricing.monthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

function AvailablePlotCard({
  block,
  wallName,
  unit,
  selected,
  onSelect,
  onDelete,
}: {
  block: InventoryBlock;
  wallName: string;
  unit: MeasurementUnit;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const pricing = computeInventoryPricing(block);
  const sqFt = squareFeetFromInches(block.width_inches, block.height_inches);
  const dims = `${formatMeasurement(block.width_inches, unit)} × ${formatMeasurement(block.height_inches, unit)}`;

  const cardLabel = block.inventoryId ?? block.name;

  return (
    <div
      className={cn(
        "w-full rounded-xl border p-2.5 text-left transition-colors",
        selected ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-200" : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <p className="text-xs font-bold text-slate-800">{block.inventoryId ?? block.id}</p>
          <p className="text-[11px] text-slate-500">{block.name}</p>
        </button>
        <div className="flex shrink-0 items-center gap-1">
          <StatusBadge variant="ad" status="available" size="sm" />
          <CardDeleteButton label={cardLabel} onDelete={onDelete} />
        </div>
      </div>
      <button type="button" onClick={onSelect} className="w-full text-left">
        <p className="mt-1.5 text-[10px] text-slate-600">
          <span className="font-semibold text-slate-700">{formatLocation(block, wallName)}</span>
          {" · "}
          {presetLabel(block.sizePreset)} · {dims}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">Est. {sqFt.toFixed(1)} sq ft</p>
        <p className="mt-1 text-xs font-semibold text-amber-800">
          ${pricing.monthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo potential
        </p>
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="truncate font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function AdThumb({ assetUrl, label }: { assetUrl?: string; label: string }) {
  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {assetUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={assetUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-semibold leading-tight text-slate-400">
          {label.slice(0, 24)}
        </div>
      )}
    </div>
  );
}

function RevenueFooter({
  title,
  lines,
  highlightKey,
  tone = "revenue",
  actions = false,
}: {
  title: string;
  lines: { key: string; label: string; amount: number }[];
  highlightKey: string;
  tone?: "revenue" | "missed";
  actions?: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 p-3">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul className="mt-2 space-y-1 text-xs">
        {lines.map((line) => {
          const isHighlight = line.key === highlightKey;
          const isFirstMonth = line.key === "first";
          const isCount = line.key === "ads" || line.key === "plots";
          const isSqFt = line.key === "sqft";
          return (
            <li
              key={line.key}
              className={cn(
                "flex justify-between gap-2",
                isHighlight && (tone === "revenue" ? "font-semibold text-emerald-700" : "font-semibold text-amber-800"),
                isFirstMonth && "font-semibold text-slate-800",
                !isHighlight && !isFirstMonth && "text-slate-600",
              )}
            >
              <span>{line.label}</span>
              <span className="font-mono tabular-nums">
                {isCount || isSqFt
                  ? line.amount.toLocaleString(undefined, { maximumFractionDigits: isSqFt ? 1 : 0 })
                  : `$${line.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </span>
            </li>
          );
        })}
      </ul>
      {actions ? (
        <div className="mt-3 flex flex-col gap-2">
          <button type="button" className={cn(buttonVariants({ intent: "primary", surface: "light" }), "w-full text-xs")}>
            Add to Campaign
          </button>
          <button type="button" className={cn(buttonVariants({ intent: "secondary", surface: "light" }), "w-full text-xs")}>
            Request Approval
          </button>
        </div>
      ) : null}
    </div>
  );
}
