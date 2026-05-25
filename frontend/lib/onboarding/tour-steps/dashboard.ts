import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { TOUR_STEP_SIDEBAR, TOUR_STEP_USER_HUB } from "@/lib/onboarding/tour-steps/shared";

/** Spotlight order for the widget-system carousel (one selector per dashboard tile). */
export const DASHBOARD_WIDGET_ROTATION_TARGETS: readonly string[] = [
  '[data-tour="important-dates"]',
  '[data-tour="low-inventory"]',
  '[data-tour="workforce-widget"]',
  '[data-tour="routine-assignments"]',
  '[data-tour="pool-readings"]',
  '[data-tour="co2-monitoring"]',
  '[data-tour="work-requests"]',
  '[data-tour="training-compliance"]',
];

export const DASHBOARD_TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="department-dashboards-area"]',
    cardTarget: '[data-tour="department-dashboards-card"]',
    title: "Department Dashboards",
    description:
      "Your central command center. Here you'll find today's overview, important dates, and quick access to key metrics. Everything you need starts here.",
    placement: "bottom",
  },
  {
    target: DASHBOARD_WIDGET_ROTATION_TARGETS[0]!,
    rotateTargets: DASHBOARD_WIDGET_ROTATION_TARGETS,
    rotateIntervalMs: 2400,
    title: "Widget System",
    description:
      "Every feature comes with a moveable widget packed with compressed data—drag tiles, resize them, and choose what matters most on your dashboard.",
    placement: "center",
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
  TOUR_STEP_USER_HUB,
];

/** Widget slot id → `data-tour` on the grid tile wrapper. */
export const DASHBOARD_TOUR_TARGET_BY_WIDGET: Partial<Record<string, string>> = {
  important_dates: "important-dates",
  low_inventory: "low-inventory",
  workforce: "workforce-widget",
  routine_assignments: "routine-assignments",
  pool_readings: "pool-readings",
  co2_monitoring: "co2-monitoring",
  notifications_work_orders: "work-requests",
  training_compliance: "training-compliance",
};
