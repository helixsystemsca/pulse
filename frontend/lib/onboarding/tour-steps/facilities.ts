import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

/**
 * Anchors used by the current OpsModuleApp facilities page and the dedicated
 * FacilitiesApp (PR #18). Missing targets (empty CTA, contents, add-asset) skip.
 */
export const FACILITIES_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("facilities-tour-create"),
    title: "Add a facility",
    description: "Create a building (Arena, Aquatic Centre, …). Name is enough. Inventory and equipment can link to it afterward.",
    placement: "left",
  },
  {
    target: tourSel("facilities-tour-search"),
    title: "Search facilities",
    description: "Filter the list by name so you can open Civic Arena without scrolling.",
    placement: "bottom",
  },
  {
    target: tourSel("facilities-tour-list"),
    title: "Facility list",
    description: "Every building you have added. Open a row to edit status and details.",
    placement: "right",
  },
  {
    target: tourSel("facilities-tour-detail"),
    title: "Facility details",
    description: "Edit name, status, and notes. Save stays on this panel.",
    placement: "left",
  },
  {
    target: tourSel("facilities-tour-contents"),
    title: "What this facility has",
    description: "Assets and inventory linked to the open building. Skipped until that panel is on the page.",
    placement: "left",
  },
  {
    target: tourSel("facilities-tour-add-asset"),
    title: "Add asset from here",
    description: "Opens Equipment with this facility pre-selected. Skipped until that shortcut lands.",
    placement: "left",
  },
  {
    target: tourSel("facilities-tour-links"),
    title: "Linked records",
    description: "Attach related people, contractors, or regulations to this facility.",
    placement: "left",
  },
];
