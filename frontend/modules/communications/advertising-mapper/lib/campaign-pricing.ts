import { computeInventoryPricing } from "@/modules/communications/advertising-mapper/lib/pricing";
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

/** Roll up commercial totals for selected inventory blocks (proposal-ready shape). */
export function computeCampaignPricing(blocks: readonly InventoryBlock[]): CampaignPricingSummary {
  const selected = blocks.filter((b) => b.status === "occupied" || b.status === "reserved");
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
      { key: "ads", label: "Selected ads", amount: count },
      { key: "production", label: "Production costs", amount: productionCost },
      { key: "install", label: "Installation", amount: installationCost },
      { key: "monthly", label: "Total (monthly)", amount: monthlyTotal },
      { key: "first", label: "Total (first month)", amount: firstMonthTotal },
    ],
  };
}
