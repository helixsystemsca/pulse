"use client";

import { Loader2 } from "lucide-react";
import { useTeamEmployees } from "@/lib/team-management/hooks/useTeamEmployees";
import { displayName } from "@/lib/team-management/development-types";
import Link from "next/link";

export function PeopleCareerGoalsPanel() {
  const { employees, loading, error } = useTeamEmployees();

  if (loading) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center text-ds-muted">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
      </div>
    );
  }
  if (error) return <p className="text-sm text-ds-danger">{error}</p>;

  const withGoals = employees.filter((e) => e.development?.assessment_summary || e.development);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ds-muted">
        Career goals are stored on each employee&apos;s development profile. Open a profile from the{" "}
        <Link href="/team-management/people" className="font-semibold text-[var(--ds-accent)]">
          directory
        </Link>{" "}
        or{" "}
        <Link href="/team-management/performance" className="font-semibold text-[var(--ds-accent)]">
          Performance
        </Link>{" "}
        to edit goals and plans.
      </p>
      <ul className="space-y-2">
        {employees.map((emp) => (
          <li key={emp.id} className="ops-dash-inner-card px-4 py-3">
            <p className="text-sm font-bold text-ds-foreground">
              {displayName({ full_name: emp.full_name, email: emp.email })}
            </p>
            <p className="mt-1 text-xs text-ds-muted">
              {emp.job_title || "—"} · Quadrant {emp.development?.development_quadrant ?? "C"}
            </p>
            <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_70%,transparent)]">
              {emp.development?.assessment_summary?.trim() ||
                "No summary yet — complete an assessment in Performance."}
            </p>
          </li>
        ))}
      </ul>
      {withGoals.length === 0 && employees.length === 0 ? (
        <p className="text-sm text-ds-muted">No employees in roster.</p>
      ) : null}
    </div>
  );
}
