import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import {
  TOUR_STEP_OPS_ASK,
  TOUR_STEP_SIDEBAR,
  TOUR_STEP_USER_HUB,
} from "@/lib/onboarding/tour-steps/shared";

/** Spotlight order for optional widget tiles (used if a step still rotates). */
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
  TOUR_STEP_OPS_ASK,
  {
    target: '[data-tour="workforce-today"]',
    title: "Who is on today",
    description:
      "Staff scheduled for this facility today. Green means currently on shift. Open a name for role and assignment details.",
    placement: "bottom",
  },
  {
    target: '[data-tour="time-off-monitoring"]',
    title: "Time off",
    description: "Upcoming approved and pending time off so you can plan coverage before the shift starts.",
    placement: "bottom",
  },
  {
    target: '[data-tour="low-inventory"]',
    title: "Low stock",
    description: "Items at or below reorder point. Open a row to restock in Inventory.",
    placement: "right",
  },
  {
    target: '[data-tour="routine-assignments"]',
    title: "Routines",
    description: "Today’s routine assignments and shift handoffs. Open one to mark it done or pass it to the next shift.",
    placement: "top",
  },
  {
    target: '[data-tour="work-requests"]',
    title: "Work requests",
    description: "Open, in-progress, and overdue requests. Click through to the Work Requests queue to assign or close.",
    placement: "left",
  },
  {
    target: '[data-tour="training-compliance"]',
    title: "Training status",
    description: "Who is current, whose ticket is expiring, and where a gap will block a shift. Open Training for the matrix.",
    placement: "left",
  },
  {
    target: '[data-tour="monitoring"]',
    title: "Monitoring",
    description: "CO₂ tanks and live pool chemistry. In-range vs needs a reading — open Monitoring for the full trend.",
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
