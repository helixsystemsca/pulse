import { computeInventoryPricing } from "@/modules/communications/advertising-mapper/lib/pricing";
import { squareFeetFromInches } from "@/modules/communications/advertising-mapper/lib/measurements";
import type { InventoryBlock } from "@/modules/communications/advertising-mapper/types";

/** Active contracts on the wall (occupied or reserved). */
export function isCurrentInventory(block: InventoryBlock): boolean {
  return block.status === "occupied" || block.status === "reserved" || block.status === "expired";
}

/** Open plots available for sale. */
export function isAvailablePlot(block: InventoryBlock): boolean {
  return block.status === "available";
}

export function formatLocation(block: InventoryBlock, wallName: string): string {
  return block.locationLabel ?? block.zone ?? wallName;
}

export function contractStructureLabel(structure?: InventoryBlock["contractStructure"]): string {
  if (!structure) return "—";
  const labels: Record<NonNullable<InventoryBlock["contractStructure"]>, string> = {
    monthly: "Monthly",
    annual: "Annual",
    season: "Season",
    per_event: "Per event",
  };
  return labels[structure];
}

export function computeCurrentMonthlyRevenue(blocks: readonly InventoryBlock[]): number {
  return blocks.filter(isCurrentInventory).reduce((sum, b) => sum + computeInventoryPricing(b).monthlyTotal, 0);
}

export function computeMissedMonthlyRevenue(blocks: readonly InventoryBlock[]): number {
  return blocks.filter(isAvailablePlot).reduce((sum, b) => sum + computeInventoryPricing(b).monthlyTotal, 0);
}

export function computeAvailableSqFt(blocks: readonly InventoryBlock[]): number {
  return blocks.filter(isAvailablePlot).reduce((sum, b) => sum + squareFeetFromInches(b.width_inches, b.height_inches), 0);
}
