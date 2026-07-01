import { PeopleSubPageShell } from "@/components/team-management/people/PeopleSubPageShell";

export const metadata = { title: "Emergency Contacts · People" };

export default function PeopleEmergencyContactsPage() {
  return (
    <PeopleSubPageShell title="Emergency Contacts" description="Emergency contact records (coming soon).">
      <div className="ops-dash-inner-card max-w-xl p-5">
        <p className="text-sm text-ds-muted">
          Emergency contacts will be stored on employee HR profiles in the Team Roster.
        </p>
      </div>
    </PeopleSubPageShell>
  );
}
