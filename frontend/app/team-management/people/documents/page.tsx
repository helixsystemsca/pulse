import { PeopleSubPageShell } from "@/components/team-management/people/PeopleSubPageShell";

export const metadata = { title: "Documents · People" };

export default function PeopleDocumentsPage() {
  return (
    <PeopleSubPageShell title="Documents" description="Employee documents and file storage (coming soon).">
      <div className="ops-dash-inner-card max-w-xl p-5">
        <p className="text-sm text-ds-muted">
          Employee document library will attach to roster profiles without duplicating employee records.
        </p>
      </div>
    </PeopleSubPageShell>
  );
}
