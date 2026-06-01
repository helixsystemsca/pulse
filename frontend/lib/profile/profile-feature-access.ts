import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { canAccessClassicNavHref } from "@/lib/rbac/session-access";
import type { PulseAuthSession } from "@/lib/pulse-session";

const GAMIFICATION_FEATURES = ["team_insights", "work_requests", "maintenance"] as const;
const SCHEDULE_FEATURES = ["schedule", "work_requests"] as const;
const TRAINING_FEATURES = [
  "procedures",
  "standards",
  "standards_training",
  "standards_compliance",
  "standards_certifications",
] as const;

export function profileShowsGamification(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return GAMIFICATION_FEATURES.some((f) => isUserFeatureEnabled(session, f));
}

export function profileShowsWorkAndSchedule(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return (
    SCHEDULE_FEATURES.some((f) => isUserFeatureEnabled(session, f)) ||
    isUserFeatureEnabled(session, "team_management")
  );
}

export function profileShowsTrainingRecommendations(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return TRAINING_FEATURES.some((f) => isUserFeatureEnabled(session, f));
}

/** Gamification, schedule, training, or other workforce sections beyond avatar + password. */
export function hasExtendedProfileContent(session: PulseAuthSession | null): boolean {
  return (
    profileShowsGamification(session) ||
    profileShowsWorkAndSchedule(session) ||
    profileShowsTrainingRecommendations(session)
  );
}

export function profileShowsExtendedAccountSettings(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return (
    isUserFeatureEnabled(session, "dashboard") ||
    canAccessClassicNavHref(session, "/settings") ||
    profileShowsGamification(session)
  );
}

export function profileShowsEditDrawer(session: PulseAuthSession | null): boolean {
  return hasExtendedProfileContent(session);
}

export function profileShowsPermissionsFooter(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  return canAccessClassicNavHref(session, "/dashboard/permissions");
}
