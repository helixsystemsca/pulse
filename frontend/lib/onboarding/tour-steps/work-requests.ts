import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

export const WORK_REQUESTS_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("work-requests-tour-create"),
    title: "New work request",
    description: "Log a job: title and sub-location are required. Assign, set priority, and link an asset on the same form.",
    placement: "left",
  },
  {
    target: tourSel("work-requests-tour-pm"),
    title: "New PM plan",
    description: "Create a preventative maintenance plan that generates work on a schedule. Managers only — skipped otherwise.",
    placement: "left",
  },
  {
    target: tourSel("work-requests-tour-tabs"),
    title: "My work / Approval / All",
    description: "My work is assigned to you. Approval is the queue. All requests is the full list for this facility.",
    placement: "bottom",
  },
  {
    target: tourSel("work-requests-tour-search"),
    title: "Search requests",
    description: "Find a request by title, asset, or location.",
    placement: "bottom",
  },
  {
    target: tourSel("work-requests-tour-filters"),
    title: "Filter the queue",
    description: "Limit by priority, location, category, workflow status, and due date. Clear filters resets the table.",
    placement: "bottom",
  },
  {
    target: tourSel("work-requests-tour-list"),
    title: "Request list",
    description: "Open a row for comments, status changes, assignment, and the linked asset.",
    placement: "top",
  },
];
