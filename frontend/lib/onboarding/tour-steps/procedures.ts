import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

/** Procedure library (`/training/learning/library`) — create, assign, filter, list. */
export const PROCEDURES_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("procedures-tour-create"),
    title: "Create procedure",
    description: "Add an SOP with numbered steps. Set training priority so it appears on the compliance matrix.",
    placement: "left",
  },
  {
    target: tourSel("procedures-tour-assign"),
    title: "Assign a procedure",
    description: "Send a procedure to a worker for completion or revision. Skipped if you cannot assign.",
    placement: "left",
  },
  {
    target: tourSel("procedures-tour-filter"),
    title: "Filter the library",
    description: "Search saved internal keywords (not step text) to find a procedure by location or topic.",
    placement: "bottom",
  },
  {
    target: tourSel("procedures-tour-list"),
    title: "Procedure library",
    description: "Open a card for steps, photos, acknowledgment, and knowledge verification.",
    placement: "top",
  },
];
