import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

export const INSPECTIONS_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("inspections-tour-new-sheet"),
    title: "New inspection sheet",
    description: "Build a reusable checklist (vehicle, harness, or custom). Run it on shift from the list below.",
    placement: "left",
  },
  {
    target: tourSel("inspections-tour-new-log"),
    title: "New log template",
    description: "Create an operational log form (readings, rounds) separate from inspection checklists.",
    placement: "left",
  },
  {
    target: tourSel("inspections-tour-tabs"),
    title: "Inspections / Logs / Archive",
    description: "Inspections are checklists. Logs are repeating forms. Archive holds completed vehicle runs from this device.",
    placement: "bottom",
  },
  {
    target: tourSel("inspections-tour-metrics"),
    prepareClick: tourSel("inspections-tour-tab-inspections"),
    title: "Inspection counts",
    description: "How many sheets you have, completed runs, today’s completions, and sheets that still need a first run.",
    placement: "bottom",
  },
  {
    target: tourSel("inspections-tour-search"),
    prepareClick: tourSel("inspections-tour-tab-inspections"),
    title: "Search sheets",
    description: "Filter inspection sheets by name before you open one.",
    placement: "left",
  },
  {
    target: tourSel("inspections-tour-sheets"),
    prepareClick: tourSel("inspections-tour-tab-inspections"),
    title: "Run an inspection",
    description: "Open a sheet to fill it on shift. Edit/delete custom templates from the same card.",
    placement: "top",
  },
];
