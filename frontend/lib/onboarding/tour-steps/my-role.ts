import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { tourSel } from "@/lib/onboarding/tour-target";

export const MY_PROFILE_TOUR_STEPS: TourStep[] = [
  {
    target: tourSel("ops-me-tour-tabs"),
    title: "Profile sections",
    description: "Profile is contact details. Philosophy is how you run the site. Role is responsibilities. Authority is decision rights.",
    placement: "bottom",
  },
  {
    target: tourSel("ops-me-tour-profile"),
    prepareClick: tourSel("ops-me-tour-tab-profile"),
    title: "Your details",
    description: "Display name, position, department, manager, start date, contact. Changes save when you leave a field.",
    placement: "bottom",
  },
  {
    target: tourSel("ops-me-tour-philosophy"),
    prepareClick: tourSel("ops-me-tour-tab-philosophy"),
    title: "Philosophy & principles",
    description: "Role purpose, how you run the site, and operating principles. Saves when you leave a field.",
    placement: "bottom",
  },
  {
    target: tourSel("ops-me-tour-role"),
    prepareClick: tourSel("ops-me-tour-tab-role"),
    title: "Role & responsibilities",
    description: "Add the jobs this role owns — title, category, and priority.",
    placement: "bottom",
  },
  {
    target: tourSel("ops-me-tour-authority"),
    prepareClick: tourSel("ops-me-tour-tab-authority"),
    title: "Authority matrix",
    description: "Record which decisions you can make, consult on, or escalate.",
    placement: "bottom",
  },
];
