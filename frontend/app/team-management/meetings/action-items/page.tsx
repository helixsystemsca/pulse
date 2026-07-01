import { ActionItemsSection } from "@/components/team-management/meetings/ActionItemsSection";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { MEETINGS_SUB_NAV } from "@/lib/team-management/navigation";

export const metadata = { title: "Action Items · Meetings" };

export default function MeetingsActionItemsPage() {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={MEETINGS_SUB_NAV} ariaLabel="Meetings sections" />
      <ActionItemsSection />
    </div>
  );
}
