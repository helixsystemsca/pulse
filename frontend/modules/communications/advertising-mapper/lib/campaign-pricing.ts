import { isAvailablePlot, isCurrentInventory } from "@/modules/communications/advertising-mapper/lib/inventory-rail";
import { computeInventoryPricing } from "@/modules/communications/advertising-mapper/lib/pricing";
import { squareFeetFromInches } from "@/modules/communications/advertising-mapper/lib/measurements";
import type { InventoryBlock } from "@/modules/communications/advertising-mapper/types";

export type CampaignCostLine = {
  key: string;
  label: string;
  amount: number;
};

export type CampaignPricingSummary = {
  selectedCount: number;
  productionCost: number;
  installationCost: number;
  monthlyTotal: number;
  firstMonthTotal: number;
  lines: CampaignCostLine[];
};

const PRODUCTION_PER_SLOT = 425;
const INSTALL_PER_SLOT = 400;

/** Roll up commercial totals for active contracts (occupied, reserved, expired). */
export function computeCampaignPricing(blocks: readonly InventoryBlock[]): CampaignPricingSummary {
  const selected = blocks.filter(isCurrentInventory);
  const count = selected.length;
  const productionCost = count * PRODUCTION_PER_SLOT;
  const installationCost = count * INSTALL_PER_SLOT;
  let monthlyTotal = 0;
  for (const block of selected) {
    monthlyTotal += computeInventoryPricing(block).monthlyTotal;
  }
  const firstMonthTotal = monthlyTotal + productionCost + installationCost;

  return {
    selectedCount: count,
    productionCost,
    installationCost,
    monthlyTotal,
    firstMonthTotal,
    lines: [
      { key: "ads", label: "Active ads", amount: count },
      { key: "production", label: "Production costs", amount: productionCost },
      { key: "install", label: "Installation", amount: installationCost },
      { key: "monthly", label: "Total (monthly)", amount: monthlyTotal },
      { key: "first", label: "Total (first month)", amount: firstMonthTotal },
    ],
  };
}

export type AvailableOpportunitySummary = {
  plotCount: number;
  totalSqFt: number;
  monthlyPotential: number;
  productionCost: number;
  installationCost: number;
  firstMonthPotential: number;
  lines: CampaignCostLine[];
};

/** Roll up missed revenue for open plots (available status only). */
export function computeAvailableOpportunity(blocks: readonly InventoryBlock[]): AvailableOpportunitySummary {
  const plots = blocks.filter(isAvailablePlot);
  const plotCount = plots.length;
  const productionCost = plotCount * PRODUCTION_PER_SLOT;
  const installationCost = plotCount * INSTALL_PER_SLOT;
  let monthlyPotential = 0;
  let totalSqFt = 0;
  for (const block of plots) {
    monthlyPotential += computeInventoryPricing(block).monthlyTotal;
    totalSqFt += squareFeetFromInches(block.width_inches, block.height_inches);
  }
  const firstMonthPotential = monthlyPotential + productionCost + installationCost;

  return {
    plotCount,
    totalSqFt,
    monthlyPotential,
    productionCost,
    installationCost,
    firstMonthPotential,
    lines: [
      { key: "plots", label: "Open plots", amount: plotCount },
      { key: "sqft", label: "Est. space (sq ft)", amount: Math.round(totalSqFt * 10) / 10 },
      { key: "production", label: "Production (if sold)", amount: productionCost },
      { key: "install", label: "Installation (if sold)", amount: installationCost },
      { key: "monthly", label: "Missed revenue (monthly)", amount: monthlyPotential },
      { key: "first", label: "Missed (first month)", amount: firstMonthPotential },
    ],
  };
}
