import { Suspense } from "react";
import { OnboardingSection } from "@/components/team-management/sections/OnboardingSection";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { GROWTH_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Onboarding · Growth" };

export default function GrowthOnboardingPage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={GROWTH_SUB_NAV} ariaLabel="Growth sections" />
      <Suspense fallback={<div className="text-sm text-ds-muted">Loading onboarding…</div>}>
        <OnboardingSection />
      </Suspense>
    </div>
  );
}
