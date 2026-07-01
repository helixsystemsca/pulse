import { TeamMeetingsSection } from "@/components/team-management/meetings/TeamMeetingsSection";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { MEETINGS_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Team Meetings · Meetings" };

export default function MeetingsTeamMeetingsPage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={MEETINGS_SUB_NAV} ariaLabel="Meetings sections" />
      <TeamMeetingsSection />
    </div>
  );
}
