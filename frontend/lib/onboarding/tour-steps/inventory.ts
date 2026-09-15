import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

export const INVENTORY_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("inventory-tour-tabs"),
    title: "Inventory sections",
    description:
      "Switch between the item list, replenishment queue, vendors, purchasing, receipts, history, and analytics without leaving Inventory.",
    placement: "bottom",
  },
  {
    target: tourSel("inventory-tour-filters"),
    title: "Filter the catalog",
    description:
      "Narrow by stock status, search, type/category, location, department, and date. Clear filters resets the list.",
    placement: "bottom",
  },
  {
    target: tourSel("inventory-tour-facility"),
    title: "Filter by facility",
    description: "Show only items linked to a building (Arena, Aquatic Centre, …). Skipped if that filter is not on this tenant yet.",
    placement: "bottom",
  },
  {
    target: tourSel("inventory-tour-list"),
    title: "Item list",
    description: "Open a row for quantities, location, movements, and photos. Facility shows on the row when it is linked.",
    placement: "top",
  },
  {
    target: tourSel("inventory-tour-create"),
    title: "Register item",
    description: "Add a tool, part, or consumable. Name is enough to start; link a facility when you have one.",
    placement: "left",
  },
];
