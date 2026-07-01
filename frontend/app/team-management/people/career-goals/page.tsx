import { PeopleCareerGoalsPanel } from "@/components/team-management/people/components/PeopleCareerGoalsPanel";
import { PeopleSubPageShell, PeopleTrainingLinkCard } from "@/components/team-management/people/PeopleSubPageShell";

export const metadata = { title: "Career Goals · People" };

export default function PeopleCareerGoalsPage() {
  return (
    <PeopleSubPageShell
      title="Career Goals"
      description="Career aspirations and development focus — linked to Performance development profiles."
    >
      <PeopleCareerGoalsPanel />
    </PeopleSubPageShell>
  );
}
