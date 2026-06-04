import type { TourStep } from "@/lib/onboarding/tour-steps/types";

export const INVENTORY_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="inventory-tour-tabs"]',
    title: "Inventory sections",
    description:
      "Switch between the item list, replenishment queue, vendors, purchasing, receipts, history, and analytics without leaving Inventory.",
    placement: "bottom",
  },
  {
    target: '[data-tour="inventory-tour-filters"]',
    title: "Filters",
    description:
      "Narrow the list by stock status, search text, type or category, location, department, and date range. Use Clear filters to reset everything.",
    placement: "bottom",
  },
  {
    target: '[data-tour="inventory-tour-list"]',
    title: "Item list",
    description:
      "Browse registered tools, parts, and consumables. Open a row for quantities, locations, movements, and photos.",
    placement: "top",
  },
  {
    target: '[data-tour="inventory-tour-create"]',
    title: "Register item",
    description: "Add a new tool, part, or consumable to the catalog when you have inventory.manage permission.",
    placement: "left",
  },
];
