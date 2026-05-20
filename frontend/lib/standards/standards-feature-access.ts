/**
 * Standards sub-feature access — presentation routes only.
 * Legacy `procedures` / `standards` contract keys grant all Standards sub-modules until migrated.
 */
import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { readAccessSnapshot, snapshotHasFeature } from "@/lib/access-snapshot";
import type { PulseAuthSession } from "@/lib/pulse-session";

export const STANDARDS_SUB_FEATURE_KEYS = [
  "standards_training",
  "standards_certifications",
  "standards_compliance",
] as const;

export type StandardsSubFeatureKey = (typeof STANDARDS_SUB_FEATURE_KEYS)[number];

const LEGACY_STANDARDS_BUNDLE = ["procedures", "standards"] as const;

function legacyStandardsBundleEnabled(session: PulseAuthSession | null): boolean {
  if (!session) return false;
  const snap = readAccessSnapshot(session);
  if (snap) {
    return LEGACY_STANDARDS_BUNDLE.some((k) => snapshotHasFeature(snap, k));
  }
  return LEGACY_STANDARDS_BUNDLE.some((k) => isUserFeatureEnabled(session, k));
}

/** Matrix / contract feature gate for Standards sub-modules (training, certifications, compliance). */
export function isStandardsSubFeatureEnabled(
  session: PulseAuthSession | null,
  featureKey: StandardsSubFeatureKey | string,
): boolean {
  if (!session) return false;
  if (isUserFeatureEnabled(session, featureKey)) return true;
  return legacyStandardsBundleEnabled(session);
}

export function standardsSegmentVisible(
  session: PulseAuthSession | null,
  segment: "procedures" | "training" | "certifications" | "compliance",
): boolean {
  if (!session) return false;
  if (segment === "procedures") {
    return isUserFeatureEnabled(session, "procedures") || legacyStandardsBundleEnabled(session);
  }
  if (segment === "training") return isStandardsSubFeatureEnabled(session, "standards_training");
  if (segment === "certifications") return isStandardsSubFeatureEnabled(session, "standards_certifications");
  return isStandardsSubFeatureEnabled(session, "standards_compliance");
}
