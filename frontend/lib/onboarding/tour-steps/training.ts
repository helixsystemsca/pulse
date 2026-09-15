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
    target: tourSel("training-learning-tab-library"),
    title: "Procedure library tab",
    description: "Open Procedure library for the SOP catalog. That screen has its own walkthrough of create, assign, and filter.",
    placement: "bottom",
  },
];

export const TRAINING_FLASHCARDS_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("training-flashcards-header"),
    title: "Certification flashcards",
    description: "Study published packs (CAPM, FMP, Six Sigma, …) with spaced repetition. Open a deck to pick a section.",
    placement: "bottom",
  },
  {
    target: tourSel("training-flashcards-manage"),
    title: "Manage decks",
    description: "Import, rename, export, or archive packs. Managers and admins only — skipped otherwise.",
    placement: "left",
  },
  {
    target: tourSel("training-flashcards-decks"),
    title: "Open a pack",
    description: "Each card is a certification deck. Tap one to choose a section and start studying.",
    placement: "top",
  },
  {
    target: tourSel("training-flashcards-empty"),
    title: "No packs yet",
    description: "Packs are imported per tenant — they are not loaded from the git repo. Use Manage decks → Import, or skip this step when decks exist.",
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
