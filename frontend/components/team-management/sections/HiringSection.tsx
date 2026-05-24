"use client";

import { ClipboardList } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { HIRING_PIPELINE_STAGES } from "@/lib/team-management/mock-data";

export function HiringSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Hiring"
        description="Structured candidate pipeline focused on coachability, communication, initiative, and growth potential."
        icon={ClipboardList}
      />
      <PageBody>
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,22rem)]">
          <div className="ops-dash-inner-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)]">
              Pipeline board
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {HIRING_PIPELINE_STAGES.map((col) => (
                <div
                  key={col.stage}
                  className="rounded-xl border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] bg-[color-mix(in_srgb,var(--ds-text-primary)_3%,transparent)] p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]">{col.stage}</p>
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] px-2 py-0.5 text-[10px] font-bold tabular-nums text-[var(--ds-accent)]">
                      {col.count}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">{col.note}</p>
                  <div className="mt-3 space-y-2">
                    {Array.from({ length: Math.min(col.count, 2) }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-dashed border-[color-mix(in_srgb,var(--ds-text-primary)_12%,transparent)] px-2 py-2 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_52%,transparent)]"
                      >
                        Candidate card · interview notes
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <aside className="space-y-3">
            <div className="ops-dash-inner-card p-4">
              <p className="text-xs font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]">Interview score template</p>
              <ul className="mt-2 space-y-1.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_62%,transparent)]">
                <li>Coachability & learning speed</li>
                <li>Initiative & ownership</li>
                <li>Communication & guest focus</li>
                <li>Growth potential & values fit</li>
              </ul>
            </div>
            <div className="ops-dash-inner-card p-4">
              <p className="text-xs font-bold text-[color-mix(in_srgb,var(--ds-text-primary)_88%,transparent)]">Onboarding readiness</p>
              <p className="mt-1 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_58%,transparent)]">
                Offer accepted → checklist auto-starts in Onboarding when hired.
              </p>
            </div>
          </aside>
        </div>
      </PageBody>
    </div>
  );
}
