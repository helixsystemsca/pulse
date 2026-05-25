import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { TOUR_STEP_FEEDBACK, TOUR_STEP_SIDEBAR } from "@/lib/onboarding/tour-steps/shared";

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="leadership-dashboard"]',
    title: "Leadership Dashboard",
    description:
      "Your central command center. Here you'll find today's overview, important dates, and quick access to key metrics. Everything you need starts here.",
    placement: "right",
  },
  {
    target: '[data-tour="workforce-today"]',
    title: "Today's Workforce",
    description:
      "See who's scheduled today at a glance. Green indicators show staff currently on shift, with role badges for quick identification. Click any name to see more details.",
    placement: "bottom",
  },
  {
    target: '[data-tour="time-off-monitoring"]',
    title: "Time-Off Monitoring",
    description:
      "Track upcoming time-off requests in one place. Color-coded by staff member with clear date ranges, so you can plan coverage ahead of time.",
    placement: "bottom",
  },
  {
    target: '[data-tour="low-inventory"]',
    title: "Low Inventory Alerts",
    description:
      "Never run out of essential supplies. This section flags items that need reordering, with direct links to review and restock.",
    placement: "right",
  },
  {
    target: '[data-tour="routine-assignments"]',
    title: "Routine Assignments",
    description:
      "Manage shift handoffs and routine tasks. This is your demo area to explore workforce scheduling and daily assignment flows.",
    placement: "top",
  },
  {
    target: '[data-tour="work-requests"]',
    title: "Work Requests Dashboard",
    description:
      "Track all maintenance and work requests in one place. Color-coded status indicators show pending, in-progress, overdue, and completed items at a glance.",
    placement: "left",
  },
  {
    target: '[data-tour="training-compliance"]',
    title: "Training Compliance",
    description:
      "See certification and training status at a glance—who's current, what's expiring, and where gaps need attention before they become schedule issues.",
    placement: "left",
  },
  {
    target: '[data-tour="monitoring"]',
    title: "Monitoring",
    description:
      "CO₂ tanks and live pool chemistry in one place. Visual indicators show what's in range and what needs attention—open Monitoring for the full view.",
    placement: "left",
  },
  TOUR_STEP_SIDEBAR,
  TOUR_STEP_FEEDBACK,
];

/** Widget slot id → `data-tour` when the whole card is the target. */
export const DASHBOARD_TOUR_TARGET_BY_WIDGET: Partial<Record<string, string>> = {
  important_dates: "leadership-dashboard",
  low_inventory: "low-inventory",
  co2_monitoring: "monitoring",
  pool_readings: "monitoring",
  routine_assignments: "routine-assignments",
  notifications_work_orders: "work-requests",
  training_compliance: "training-compliance",
};
