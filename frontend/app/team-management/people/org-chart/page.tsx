import { PeopleSubPageShell } from "@/components/team-management/people/PeopleSubPageShell";

export const metadata = { title: "Org Chart · People" };

export default function PeopleOrgChartPage() {
  return (
    <PeopleSubPageShell title="Org Chart" description="Organization structure visualization (coming soon).">
      <div className="ops-dash-inner-card max-w-xl p-5">
        <p className="text-sm text-ds-muted">
          Interactive org chart will use supervisor relationships from the Team Roster.
        </p>
      </div>
    </PeopleSubPageShell>
  );
}
