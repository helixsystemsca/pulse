import { PeopleSubPageShell } from "@/components/team-management/people/PeopleSubPageShell";
import { HireDocumentsRoster } from "@/components/team-management/people/HireDocumentsRoster";

export const metadata = { title: "Documents · People" };

export default function PeopleDocumentsPage() {
  return (
    <PeopleSubPageShell
      title="Documents"
      description="Required hire documents live with the employee record. File storage for attachments will follow."
    >
      <HireDocumentsRoster />
    </PeopleSubPageShell>
  );
}
