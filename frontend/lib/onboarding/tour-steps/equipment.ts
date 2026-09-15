import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

export const EQUIPMENT_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("equipment-tour-tabs"),
    title: "Equipment sections",
    description: "Overview is counts. Equipment List is the registry. Add Equipment opens a blank asset form.",
    placement: "bottom",
  },
  {
    target: tourSel("equipment-tour-stats"),
    prepareClick: tourSel("equipment-tour-overview-tab"),
    title: "Asset counts",
    description: "Totals by status plus parts due soon or overdue. Empty until you register the first asset.",
    placement: "bottom",
  },
  {
    target: tourSel("equipment-tour-add-tab"),
    title: "Add an asset",
    description: "Opens the form. Name is required. You can set type, status, and service dates on the same screen.",
    placement: "left",
  },
  {
    target: tourSel("equipment-tour-filters"),
    prepareClick: tourSel("equipment-tour-list-tab"),
    title: "Filter assets",
    description:
      "Search by name or serial, then filter by type and status. Filter by facility when that control is on the page.",
    placement: "bottom",
  },
  {
    target: tourSel("equipment-tour-facility-filter"),
    title: "Filter by facility",
    description: "Show only assets at one building. Skipped until the facility picker is on this list.",
    placement: "bottom",
  },
  {
    target: tourSel("equipment-tour-list"),
    prepareClick: tourSel("equipment-tour-list-tab"),
    title: "Asset list",
    description: "Open a row for maintenance history, parts, and sub-assets. View / Edit stay on this page.",
    placement: "top",
  },
];
