import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { INVENTORY_TOUR_STEPS } from "@/lib/onboarding/tour-steps/inventory";
import {
  PLANNER_ANALYTICS_TOUR_STEPS,
  PLANNER_INBOX_TOUR_STEPS,
  PLANNER_ROUTINE_TOUR_STEPS,
  PLANNER_TODAY_TOUR_STEPS,
} from "@/lib/onboarding/tour-steps/planner";

/** Per-feature control-by-control walkthroughs. Missing anchors are skipped at runtime. */
export const CUSTOM_FEATURE_TOUR_STEPS: Partial<Record<string, TourStep[]>> = {
  inventory: INVENTORY_TOUR_STEPS,
  daily_planner: PLANNER_TODAY_TOUR_STEPS,
  daily_planner_inbox: PLANNER_INBOX_TOUR_STEPS,
  daily_planner_routine: PLANNER_ROUTINE_TOUR_STEPS,
  daily_planner_analytics: PLANNER_ANALYTICS_TOUR_STEPS,
};

/** New detailed tours use a distinct id so they run even if the old one-page tour was dismissed. */
const RETARGETED_TOUR_KEYS = new Set([
  "daily_planner",
  "daily_planner_inbox",
  "daily_planner_routine",
  "daily_planner_analytics",
]);

export function customFeatureTourId(featureKey: string, fallbackId: string): string {
  if (RETARGETED_TOUR_KEYS.has(featureKey)) return `feature-${featureKey}-walkthrough`;
  return fallbackId;
}
