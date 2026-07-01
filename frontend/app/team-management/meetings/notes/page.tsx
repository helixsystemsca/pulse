import { MeetingHistorySection } from "@/components/team-management/meetings/MeetingHistorySection";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { MEETINGS_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Meeting History · Meetings" };

export default function MeetingsNotesPage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={MEETINGS_SUB_NAV} ariaLabel="Meetings sections" />
      <MeetingHistorySection />
    </div>
  );
}
