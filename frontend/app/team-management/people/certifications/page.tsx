import { PeopleSubPageShell, PeopleTrainingLinkCard } from "@/components/team-management/people/PeopleSubPageShell";

export const metadata = { title: "Certifications · People" };

export default function PeopleCertificationsPage() {
  return (
    <PeopleSubPageShell
      title="Certifications"
      description="Employee certifications and expiring credentials from the shared roster."
    >
      <PeopleTrainingLinkCard
        title="Workforce qualifications"
        description="Certifications registry, expiring credentials, and compliance queues."
        href="/training/compliance/workers"
      />
    </PeopleSubPageShell>
  );
}
