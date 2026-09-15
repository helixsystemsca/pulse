import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

export const TRAINING_OVERVIEW_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("training-overview-kpis"),
    title: "Training KPIs",
    description:
      "Expiring (60 days), expired, missing proof, pending verification, and compliance %. Open a tile to jump to that queue.",
    placement: "bottom",
  },
  {
    target: tourSel("training-overview-alerts"),
    title: "Operational alerts",
    description: "Workers with qualification gaps and certifications with zero qualified holders — staffing risk before the shift.",
    placement: "top",
  },
  {
    target: tourSel("training-overview-actions"),
    title: "Jump to work",
    description: "Open the worker roster, the qualification matrix, or the procedure library from here.",
    placement: "left",
  },
  {
    target: tourSel("training-overview-queue"),
    title: "Priority queue",
    description: "Expiring and expired items that need a supervisor before they block a shift.",
    placement: "top",
  },
];

export const TRAINING_LEARNING_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("training-learning-tabs"),
    title: "Learning sections",
    description:
      "My Learning is assigned work. Procedure library is the SOP catalog. Courses, study, and paths are structured training.",
    placement: "bottom",
  },
  {
    target: tourSel("training-learning-assigned"),
    title: "Your assignments",
    description: "Read, acknowledge, and submit proof. Compliance updates after a supervisor verifies.",
    placement: "top",
  },
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

export const TRAINING_COMPLIANCE_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("training-compliance-tabs"),
    title: "Compliance views",
    description: "Overview is KPIs. Employees is the roster. Training Matrix is who is current on each procedure.",
    placement: "bottom",
  },
  {
    target: tourSel("training-compliance-kpis"),
    prepareClick: tourSel("training-compliance-tab-overview"),
    title: "Compliance KPIs",
    description: "Headcount, fully compliant, missing routines, expiring soon, and high-risk gaps.",
    placement: "bottom",
  },
  {
    target: tourSel("training-compliance-filters"),
    prepareClick: tourSel("training-compliance-tab-matrix"),
    title: "Matrix filters",
    description: "Limit columns by training tier, highlight a status, and search an employee or department.",
    placement: "bottom",
  },
  {
    target: tourSel("training-compliance-matrix"),
    prepareClick: tourSel("training-compliance-tab-matrix"),
    title: "Qualification matrix",
    description: "Rows are people, columns are procedures. Open a cell (admins) to override complete / not complete / N/A.",
    placement: "top",
  },
];
