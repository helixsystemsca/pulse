import { TeamManagementFuturePage } from "@/components/team-management/shared/TeamManagementFuturePage";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { PLANNING_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Vacancy Tracking · Planning" };

export default function PlanningVacancyPage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={PLANNING_SUB_NAV} ariaLabel="Planning sections" />
      <TeamManagementFuturePage title="Vacancy Tracking" description="Open roles and vacancy pipeline." />
    </div>
  );
}
