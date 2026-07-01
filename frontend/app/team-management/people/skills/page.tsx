import { PeopleSubPageShell, PeopleTrainingLinkCard } from "@/components/team-management/people/PeopleSubPageShell";

export const metadata = { title: "Skills Matrix · People" };

export default function PeopleSkillsPage() {
  return (
    <PeopleSubPageShell
      title="Skills Matrix"
      description="Workforce skills and training matrix — powered by the Training module."
    >
      <PeopleTrainingLinkCard
        title="Training compliance matrix"
        description="View skills, procedures, and certification status across your team."
        href="/training/compliance/matrix"
      />
    </PeopleSubPageShell>
  );
}
