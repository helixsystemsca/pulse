"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { StatusBadge } from "@/components/communications/StatusBadge";
import { ConstraintDetailsPanel } from "@/modules/communications/advertising-mapper/components/ConstraintDetailsPanel";
import { InventoryDetailsPanel } from "@/modules/communications/advertising-mapper/components/InventoryDetailsPanel";
import { computeCampaignPricing } from "@/modules/communications/advertising-mapper/lib/campaign-pricing";
import { computeInventoryPricing } from "@/modules/communications/advertising-mapper/lib/pricing";
import { formatMeasurement, squareFeetFromInches } from "@/modules/communications/advertising-mapper/lib/measurements";
import type { ConstraintRegion } from "@/modules/communications/advertising-mapper/geometry/types";
import type { FacilityWallPlan, InventoryBlock, MeasurementUnit } from "@/modules/communications/advertising-mapper/types";
import { WallBackdropUpload } from "@/modules/communications/advertising-mapper/components/editor/WallBackdropUpload";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type InspectorTab = "inventory" | "properties" | "layers";

export type AdvertisingLayerVisibility = {
  backdrop: boolean;
  constraints: boolean;
  inventory: boolean;
};

type Props = {
  wall: FacilityWallPlan;
  unit: MeasurementUnit;
  selectedInventoryId: string | null;
  selectedConstraint: ConstraintRegion | null;
  layerVisibility: AdvertisingLayerVisibility;
  onLayerVisibilityChange: (patch: Partial<AdvertisingLayerVisibility>) => void;
  onSelectInventory: (id: string) => void;
  onBlockChange: (id: string, patch: Partial<InventoryBlock>) => void;
  onConstraintUpdate: (id: string, patch: Partial<ConstraintRegion>) => void;
  onConstraintDelete: () => void;
  onBackdropChange?: (patch: {
    backdropUrl?: string;
    backdropNaturalWidth?: number;
    backdropNaturalHeight?: number;
  }) => void;
};

export function AdvertisingInspectorPanel({
  wall,
  unit,
  selectedInventoryId,
  selectedConstraint,
  layerVisibility,
  onLayerVisibilityChange,
  onSelectInventory,
  onBlockChange,
  onConstraintUpdate,
  onConstraintDelete,
  onBackdropChange,
}: Props) {
  const [tab, setTab] = useState<InspectorTab>("inventory");
  const [query, setQuery] = useState("");

  const selectedBlock = useMemo(
    () => wall.blocks.find((b) => b.id === selectedInventoryId) ?? null,
    [wall.blocks, selectedInventoryId],
  );

  const filteredBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return wall.blocks;
    return wall.blocks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.inventoryId?.toLowerCase().includes(q) ?? false) ||
        (b.sponsor?.toLowerCase().includes(q) ?? false),
    );
  }, [query, wall.blocks]);

  const campaign = useMemo(() => computeCampaignPricing(wall.blocks), [wall.blocks]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 border-b border-slate-200">
        {(
          [
            ["inventory", "Inventory"],
            ["properties", "Properties"],
            ["layers", "Layers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "flex-1 border-b-2 px-2 py-2.5 text-xs font-semibold transition-colors",
              tab === id
                ? "border-sky-500 text-sky-700"
                : "border-transparent text-slate-500 hover:text-slate-800",
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "inventory" ? (
          <div className="flex flex-col gap-3 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search inventory…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-800 placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-2">
              {filteredBlocks.map((block) => (
                <InventoryCard
                  key={block.id}
                  block={block}
                  unit={unit}
                  selected={block.id === selectedInventoryId}
                  onSelect={() => onSelectInventory(block.id)}
                />
              ))}
              {filteredBlocks.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">No inventory matches your search.</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === "properties" ? (
          <div className="p-3">
            {selectedConstraint ? (
              <ConstraintDetailsPanel
                constraint={selectedConstraint}
                onUpdate={(patch) => onConstraintUpdate(selectedConstraint.id, patch)}
                onDelete={onConstraintDelete}
              />
            ) : (
              <InventoryDetailsPanel
                block={selectedBlock}
                unit={unit}
                onUpdate={(patch) => {
                  if (selectedInventoryId) onBlockChange(selectedInventoryId, patch);
                }}
              />
            )}
          </div>
        ) : null}

        {tab === "layers" ? (
          <div className="space-y-3 p-3">
            {onBackdropChange ? (
              <WallBackdropUpload wall={wall} onBackdropChange={onBackdropChange} />
            ) : null}
            <LayerToggle
              label="Backdrop"
              checked={layerVisibility.backdrop}
              onChange={(v) => onLayerVisibilityChange({ backdrop: v })}
            />
            <LayerToggle
              label="Constraints"
              checked={layerVisibility.constraints}
              onChange={(v) => onLayerVisibilityChange({ constraints: v })}
            />
            <LayerToggle
              label="Inventory"
              checked={layerVisibility.inventory}
              onChange={(v) => onLayerVisibilityChange({ inventory: v })}
            />
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Layer visibility is local to your session. Document geometry is unchanged.
            </p>
          </div>
        ) : null}
      </div>

      {tab === "inventory" ? (
        <CommercialFooter campaign={campaign} />
      ) : null}
    </div>
  );
}

function InventoryCard({
  block,
  unit,
  selected,
  onSelect,
}: {
  block: InventoryBlock;
  unit: MeasurementUnit;
  selected: boolean;
  onSelect: () => void;
}) {
  const pricing = computeInventoryPricing(block);
  const dims = `${formatMeasurement(block.width_inches, unit)} × ${formatMeasurement(block.height_inches, unit)}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-2.5 text-left transition-colors",
        selected ? "border-sky-400 bg-sky-50/80 ring-1 ring-sky-200" : "border-slate-200 bg-white hover:border-slate-300",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-slate-800">{block.inventoryId ?? block.id}</p>
          <p className="text-[11px] text-slate-500">{block.name}</p>
        </div>
        <StatusBadge variant="ad" status={block.status} size="sm" />
      </div>
      <p className="mt-1.5 text-[10px] text-slate-500">{dims}</p>
      <p className="mt-1 text-xs font-semibold text-emerald-700">
        ${pricing.monthlyTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
      </p>
    </button>
  );
}

function LayerToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-2 hover:bg-slate-50">
      <span className="text-sm text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-sky-600"
      />
    </label>
  );
}

function CommercialFooter({ campaign }: { campaign: ReturnType<typeof computeCampaignPricing> }) {
  return (
    <div className="shrink-0 border-t border-slate-200 bg-slate-50/80 p-3">
      <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Cost summary</h4>
      <ul className="mt-2 space-y-1 text-xs">
        <li className="flex justify-between text-slate-600">
          <span>Selected ads</span>
          <span className="font-mono font-semibold">{campaign.selectedCount}</span>
        </li>
        <li className="flex justify-between text-slate-600">
          <span>Production costs</span>
          <span className="font-mono">${campaign.productionCost.toLocaleString()}</span>
        </li>
        <li className="flex justify-between text-slate-600">
          <span>Installation</span>
          <span className="font-mono">${campaign.installationCost.toLocaleString()}</span>
        </li>
        <li className="flex justify-between font-semibold text-emerald-700">
          <span>Total (monthly)</span>
          <span className="font-mono">${campaign.monthlyTotal.toLocaleString()}</span>
        </li>
        <li className="flex justify-between text-slate-800">
          <span>Total (first month)</span>
          <span className="font-mono font-bold">${campaign.firstMonthTotal.toLocaleString()}</span>
        </li>
      </ul>
      <div className="mt-3 flex flex-col gap-2">
        <button type="button" className={cn(buttonVariants({ intent: "primary", surface: "light" }), "w-full text-xs")}>
          Add to Campaign
        </button>
        <button type="button" className={cn(buttonVariants({ intent: "secondary", surface: "light" }), "w-full text-xs")}>
          Request Approval
        </button>
      </div>
    </div>
  );
}
