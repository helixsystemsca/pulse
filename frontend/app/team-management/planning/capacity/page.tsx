import { TeamManagementFuturePage } from "@/components/team-management/shared/TeamManagementFuturePage";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { PLANNING_SUB_NAV } from "@/lib/team-management/navigation";

function PlanningFuturePage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={PLANNING_SUB_NAV} ariaLabel="Planning sections" />
      <TeamManagementFuturePage title={title} description={`${title} will use roster and planning data.`} />
    </div>
  );
}

export const metadata = { title: "Capacity Planning · Planning" };
export default function PlanningCapacityPage() {
  return <PlanningFuturePage title="Capacity Planning" />;
}
