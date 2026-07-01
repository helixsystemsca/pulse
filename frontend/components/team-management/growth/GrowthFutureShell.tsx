"use client";

import { TeamManagementFuturePage } from "@/components/team-management/shared/TeamManagementFuturePage";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { GROWTH_SUB_NAV } from "@/lib/team-management/navigation";

export default function GrowthFutureShell({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <TeamSectionSubNav items={GROWTH_SUB_NAV} ariaLabel="Growth sections" />
      <TeamManagementFuturePage title={title} description={`${title} will connect to employee growth profiles.`} />
    </div>
  );
}
