import { CoordinationSection } from "@/components/team-management/sections/CoordinationSection";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { MEETINGS_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Coordination · Meetings" };

export default function MeetingsCoordinationPage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={MEETINGS_SUB_NAV} ariaLabel="Meetings sections" />
      <CoordinationSection />
    </div>
  );
}
