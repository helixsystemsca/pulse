import { redirect } from "next/navigation";

export default function LegacyOnboardingRedirectPage() {
  redirect("/team-management/growth/onboarding");
}
