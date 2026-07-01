"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmployeeDirectory } from "@/components/team-management/people/components/EmployeeDirectory";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { PEOPLE_SUB_NAV } from "@/lib/team-management/navigation";

export function PeopleSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Employee directory and profiles — the single source of truth for your team."
        icon={Users}
      />
      <TeamSectionSubNav items={PEOPLE_SUB_NAV} ariaLabel="People sections" />
      <PageBody>
        <EmployeeDirectory />
      </PageBody>
    </div>
  );
}
