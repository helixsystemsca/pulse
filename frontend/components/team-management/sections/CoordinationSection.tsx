"use client";

import { ClipboardList } from "lucide-react";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { COORDINATION_ITEMS } from "@/lib/team-management/mock-data";
import { cn } from "@/lib/cn";

const STATUS_CLASS: Record<string, string> = {
  Open: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  Watching: "bg-[color-mix(in_srgb,var(--ds-text-primary)_10%,transparent)] text-[color-mix(in_srgb,var(--ds-text-primary)_70%,transparent)]",
  "In progress": "bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] text-[var(--ds-accent)]",
  Scheduled: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
};

export function CoordinationSection() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Coordination"
        description="Bridge operations and leadership — follow-ups, handoffs, and action items."
        icon={ClipboardList}
      />
      <PageBody>
        <ul className="space-y-2">
          {COORDINATION_ITEMS.map((item) => (
            <li
              key={item.title}
              className="ops-dash-inner-card flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)]">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-[color-mix(in_srgb,var(--ds-text-primary)_55%,transparent)]">
                  Owner: {item.owner} · Due {item.due}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  STATUS_CLASS[item.status] ?? STATUS_CLASS.Watching,
                )}
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </PageBody>
    </div>
  );
}
