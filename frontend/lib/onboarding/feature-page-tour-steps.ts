import type { TourStep } from "@/lib/onboarding/tour-steps/types";
import { EQUIPMENT_TOUR_STEPS } from "@/lib/onboarding/tour-steps/equipment";
import { FACILITIES_TOUR_STEPS } from "@/lib/onboarding/tour-steps/facilities";
import { INSPECTIONS_TOUR_STEPS } from "@/lib/onboarding/tour-steps/inspections";
import { INVENTORY_TOUR_STEPS } from "@/lib/onboarding/tour-steps/inventory";
import { MY_PROFILE_TOUR_STEPS } from "@/lib/onboarding/tour-steps/my-role";
import {
  PLANNER_ANALYTICS_TOUR_STEPS,
  PLANNER_INBOX_TOUR_STEPS,
  PLANNER_ROUTINE_TOUR_STEPS,
  PLANNER_TODAY_TOUR_STEPS,
} from "@/lib/onboarding/tour-steps/planner";
import { REGULATIONS_TOUR_STEPS } from "@/lib/onboarding/tour-steps/regulations";
import { PROCEDURES_TOUR_STEPS } from "@/lib/onboarding/tour-steps/procedures";
import {
  TRAINING_COMPLIANCE_TOUR_STEPS,
  TRAINING_FLASHCARDS_TOUR_STEPS,
  TRAINING_LEARNING_TOUR_STEPS,
  TRAINING_OVERVIEW_TOUR_STEPS,
} from "@/lib/onboarding/tour-steps/training";
import { WORK_REQUESTS_TOUR_STEPS } from "@/lib/onboarding/tour-steps/work-requests";

/** Per-feature control-by-control walkthroughs. Missing anchors are skipped at runtime. */
export const CUSTOM_FEATURE_TOUR_STEPS: Partial<Record<string, TourStep[]>> = {
  inventory: INVENTORY_TOUR_STEPS,
  equipment: EQUIPMENT_TOUR_STEPS,
  work_requests: WORK_REQUESTS_TOUR_STEPS,
  logs_inspections: INSPECTIONS_TOUR_STEPS,
  ops_regulations: REGULATIONS_TOUR_STEPS,
  ops_facilities: FACILITIES_TOUR_STEPS,
  ops_me: MY_PROFILE_TOUR_STEPS,
  training_overview: TRAINING_OVERVIEW_TOUR_STEPS,
  training_learning: TRAINING_LEARNING_TOUR_STEPS,
  training_compliance: TRAINING_COMPLIANCE_TOUR_STEPS,
  training_flashcards: TRAINING_FLASHCARDS_TOUR_STEPS,
  procedures: PROCEDURES_TOUR_STEPS,
  standards_procedures: PROCEDURES_TOUR_STEPS,
  daily_planner: PLANNER_TODAY_TOUR_STEPS,
  daily_planner_inbox: PLANNER_INBOX_TOUR_STEPS,
  daily_planner_routine: PLANNER_ROUTINE_TOUR_STEPS,
  daily_planner_analytics: PLANNER_ANALYTICS_TOUR_STEPS,
};

/** New detailed tours use a distinct id so they run even if the old one-page tour was dismissed. */
export function customFeatureTourId(featureKey: string, fallbackId: string): string {
  if (CUSTOM_FEATURE_TOUR_STEPS[featureKey]) return `feature-${featureKey}-walkthrough`;
  return fallbackId;
}
