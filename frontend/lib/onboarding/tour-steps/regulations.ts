import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

export const REGULATIONS_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("regulations-tour-create"),
    title: "New reference card",
    description:
      "Add a Codes & Guidance card: title, topic, classification, and the official public URL. Do not paste copyrighted code text.",
    placement: "left",
  },
  {
    target: tourSel("regulations-tour-disclaimer"),
    title: "Not legal advice",
    description: "Summaries point at official public pages. Confirm the current wording on the linked source before you act.",
    placement: "bottom",
  },
  {
    target: tourSel("regulations-tour-search"),
    title: "Search the library",
    description: "Find a card by keyword — chief engineer, ammonia plant, refrigeration operator, pool code, building code, OH&S.",
    placement: "bottom",
  },
  {
    target: tourSel("regulations-tour-topics"),
    title: "Filter by topic",
    description: "Limit cards to one topic category, or show All.",
    placement: "bottom",
  },
  {
    target: tourSel("regulations-tour-list"),
    title: "Reference cards",
    description: "Each card shows classification (law vs guidance vs internal) and a short summary. Open one to read the rest.",
    placement: "right",
  },
  {
    target: tourSel("regulations-tour-detail"),
    title: "Official source & pointers",
    description: "Applicability, official URL, verification status, and Pulse pointers (SOPs, PMs, contractors).",
    placement: "left",
  },
];
