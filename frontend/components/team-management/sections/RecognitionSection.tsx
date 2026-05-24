"use client";

import { Sparkles } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { RECOGNITION_FEED } from "@/lib/team-management/mock-data";

export function RecognitionSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Recognition"
        description="Positive culture reinforcement — milestones, certifications, and peer appreciation."
        icon={Sparkles}
      />
      <PageBody>
        <ul className="space-y-2">
          {RECOGNITION_FEED.map((row) => (
            <li key={row.who + row.when} className="ops-dash-inner-card flex items-start justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{row.who}</p>
                <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]">{row.what}</p>
              </div>
              <time className="shrink-0 text-[11px] font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                {row.when}
              </time>
            </li>
          ))}
        </ul>
      </PageBody>
    </div>
  );
}
