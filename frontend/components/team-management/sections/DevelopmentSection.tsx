"use client";

import { Activity } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { DEVELOPMENT_PROFILES } from "@/lib/team-management/mock-data";

export function DevelopmentSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Development"
        description="Supportive growth tracking — skill progression, mentorship, and leadership readiness."
        icon={Activity}
      />
      <PageBody>
        <div className="grid gap-3 lg:grid-cols-2">
          {DEVELOPMENT_PROFILES.map((profile) => (
            <article key={profile.name} className="ops-dash-inner-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">
                    {profile.name}
                  </h3>
                  <p className="mt-0.5 text-[11px] font-semibold text-[var(--ds-accent)]">{profile.focus}</p>
                </div>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--ds-success)_14%,transparent)] px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-200">
                  Active plan
                </span>
              </div>
              <p className="mt-3 text-xs text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]">{profile.plan}</p>
              <p className="mt-2 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]">
                Mentor: {profile.mentor}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Skill progression", "Ownership areas", "Cross-training"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_65%,transparent)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
