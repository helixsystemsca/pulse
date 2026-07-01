import { WorkforcePlanningSection } from "@/components/team-management/sections/WorkforcePlanningSection";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { PLANNING_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Workforce Planning · Planning" };

export default function PlanningWorkforcePage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={PLANNING_SUB_NAV} ariaLabel="Planning sections" />
      <WorkforcePlanningSection />
    </div>
  );
}
