"use client";

import { Sparkles } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkforcePlaceholderCardView } from "@/components/team-management/WorkforcePlaceholderCard";
import { TEAM_INSIGHTS_CARDS } from "@/lib/team-management/mock-data";

export function TeamInsightsSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Insights"
        description="High-level workforce operational visibility — training, readiness, risks, and engagement in one place."
        icon={Sparkles}
      />
      <PageBody>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {TEAM_INSIGHTS_CARDS.map((card) => (
            <WorkforcePlaceholderCardView key={card.id} card={card} />
          ))}
        </div>
      </PageBody>
    </div>
  );
}
