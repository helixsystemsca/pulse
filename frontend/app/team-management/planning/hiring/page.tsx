import { HiringSection } from "@/components/team-management/sections/HiringSection";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { PLANNING_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Hiring · Planning" };

export default function PlanningHiringPage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={PLANNING_SUB_NAV} ariaLabel="Planning sections" />
      <HiringSection />
    </div>
  );
}
