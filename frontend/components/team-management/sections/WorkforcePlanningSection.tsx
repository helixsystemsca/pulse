"use client";

import { CalendarDays } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkforcePlaceholderCardView } from "@/components/team-management/WorkforcePlaceholderCard";
import { PLANNING_CARDS } from "@/lib/team-management/mock-data";

export function WorkforcePlanningSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce Planning"
        description="Proactive staffing visibility — forecasts, seasonal prep, and continuity planning."
        icon={CalendarDays}
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {PLANNING_CARDS.map((card) => (
            <WorkforcePlaceholderCardView key={card.id} card={card} />
          ))}
        </div>
      </PageBody>
    </div>
  );
}
