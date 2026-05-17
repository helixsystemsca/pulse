import { squareFeetFromInches } from "@/modules/communications/advertising-mapper/lib/measurements";
import type { InventoryBlock, PriceTier, VisibilityTier } from "@/modules/communications/advertising-mapper/types";

export type PricingLine = {
  key: string;
  label: string;
  amount: number;
  emphasis?: "normal" | "total" | "discount";
};

export type InventoryPricingSummary = {
  sqFt: number;
  lines: PricingLine[];
  monthlyTotal: number;
  termTotal: number;
};

const BASE_RATE_PER_SQFT: Record<PriceTier, number> = {
  tier_a: 14,
  tier_b: 18,
  tier_c: 24,
};

const VISIBILITY_MULTIPLIER: Record<VisibilityTier, number> = {
  standard: 1,
  premium: 1.35,
  marquee: 1.8,
};

const ZONE_MULTIPLIER: Record<string, number> = {
  "North Bowl": 1.25,
  "South Bowl": 1.15,
  Concourse: 1,
  Lobby: 1.1,
  Exterior: 1.4,
};

const SEASONAL_MULTIPLIER = 1.25;
const INSTALL_FEE = 450;
const PRODUCTION_FEE = 275;
const DISCOUNT = 500;
const TAX_RATE = 0.05;
const DEFAULT_TERM_MONTHS = 3;

/** Placeholder pricing engine — structured for future API integration. */
export function computeInventoryPricing(
  block: InventoryBlock,
  termMonths = DEFAULT_TERM_MONTHS,
): InventoryPricingSummary {
  const sqFt = squareFeetFromInches(block.width_inches, block.height_inches);
  const tier = block.priceTier ?? "tier_b";
  const visibility = block.visibilityTier ?? "standard";
  const zoneKey = block.zone ?? "Concourse";
  const baseRate = BASE_RATE_PER_SQFT[tier];
  const locationMult = ZONE_MULTIPLIER[zoneKey] ?? 1;
  const visibilityMult = VISIBILITY_MULTIPLIER[visibility];
  const monthlyBase = sqFt * baseRate * locationMult * visibilityMult * SEASONAL_MULTIPLIER;
  const monthlyAfterDiscount = Math.max(0, monthlyBase - DISCOUNT);
  const taxes = monthlyAfterDiscount * TAX_RATE;
  const monthlyTotal = monthlyAfterDiscount + taxes;
  const termSubtotal = monthlyAfterDiscount * termMonths + INSTALL_FEE + PRODUCTION_FEE;
  const termTaxes = termSubtotal * TAX_RATE;
  const termTotal = termSubtotal + termTaxes;

  const lines: PricingLine[] = [
    { key: "base", label: "Base rate", amount: baseRate, emphasis: "normal" },
    { key: "location", label: "Location multiplier", amount: locationMult, emphasis: "normal" },
    { key: "seasonal", label: "Seasonal multiplier", amount: SEASONAL_MULTIPLIER, emphasis: "normal" },
    { key: "monthly", label: "Monthly rate", amount: monthlyBase, emphasis: "normal" },
    { key: "install", label: "Install fee", amount: INSTALL_FEE, emphasis: "normal" },
    { key: "production", label: "Production fee", amount: PRODUCTION_FEE, emphasis: "normal" },
    { key: "discount", label: "Discount", amount: -DISCOUNT, emphasis: "discount" },
    { key: "taxes", label: "Taxes", amount: taxes, emphasis: "normal" },
    { key: "total_monthly", label: "Total (monthly)", amount: monthlyTotal, emphasis: "total" },
    { key: "total_term", label: `Total (${termMonths} months)`, amount: termTotal, emphasis: "total" },
  ];

  return { sqFt, lines, monthlyTotal, termTotal };
}
