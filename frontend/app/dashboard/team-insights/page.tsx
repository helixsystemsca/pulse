import { redirect } from "next/navigation";

/** Legacy gamification insights — operational Team Insights lives under Team Management. */
export default function LegacyTeamInsightsRedirectPage() {
  redirect("/team-management/insights");
}
