"use client";

import { ListChecks } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { ONBOARDING_TRACKS } from "@/lib/team-management/mock-data";
import { cn } from "@/lib/cn";

export function OnboardingSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Onboarding"
        description="Standardized onboarding and training progression for operational continuity."
        icon={ListChecks}
      />
      <PageBody>
        <div className="space-y-3">
          {ONBOARDING_TRACKS.map((track) => (
            <article key={track.title} className="ops-dash-inner-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{track.title}</h3>
                <span className="text-xs font-bold tabular-nums text-[var(--ds-accent)]">{track.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)]">
                <div
                  className="h-full rounded-full bg-[var(--ds-accent)] transition-all"
                  style={{ width: `${track.progress}%` }}
                />
              </div>
              <ul className="mt-3 space-y-1">
                {track.items.map((item) => (
                  <li
                    key={item}
                    className={cn(
                      "flex items-center gap-2 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_78%,transparent)]",
                    )}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--ds-accent)]" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
