"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Siren } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { fetchIntelligence, type OpsIntelligence } from "@/lib/recreation/commandService";

const HUB_LINKS = [
  {
    title: "Facility emergency procedures",
    href: "/recreation/facilities",
    description: "Document shutdown, evacuation, and utility emergency steps on each facility profile.",
  },
  {
    title: "Emergency contacts",
    href: "/recreation/contacts",
    description: "Ops contacts with type “emergency” — fire, utilities, after-hours callout.",
  },
  {
    title: "Emergency knowledge articles",
    href: "/recreation/knowledge",
    description: "Knowledge Base category “Emergency Procedures” for searchable playbooks.",
  },
  {
    title: "Ops Copilot",
    href: "/recreation/copilot",
    description: "Ask what’s overdue, who is qualified for ice plant work, or ammonia / pool emergency procedures — answers cite Pulse records.",
  },
  {
    title: "Regulations",
    href: "/recreation/regulations",
    description: "Technical Safety BC, WorkSafeBC, fire code references that constrain emergency action.",
  },
];

export default function EmergencyPage() {
  const [intel, setIntel] = useState<OpsIntelligence | null>(null);

  useEffect(() => {
    void fetchIntelligence()
      .then(setIntel)
      .catch(() => setIntel(null));
  }, []);

  const emergency = (intel?.emergency || {}) as Record<string, unknown>;
  const gaps = (emergency.readiness_gaps as string[] | undefined) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emergency Response"
        description="Personal readiness hub — not a replacement for municipal emergency plans. Capture and find what you need under pressure."
        icon={Siren}
      />
      <PageBody>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-ds-border bg-ds-card p-4">
            <p className="text-xs uppercase text-ds-muted">Facilities with procedures</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {Number(emergency.facilities_with_procedures ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-ds-border bg-ds-card p-4">
            <p className="text-xs uppercase text-ds-muted">Emergency contacts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {Number(emergency.emergency_contacts ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border border-ds-border bg-ds-card p-4">
            <p className="text-xs uppercase text-ds-muted">Knowledge articles</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {Number(emergency.emergency_knowledge_articles ?? 0)}
            </p>
          </div>
        </div>

        {gaps.length ? (
          <div className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Readiness gaps</p>
            <ul className="mt-1 list-disc pl-5">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mb-6 text-sm text-ds-muted">
            Basic emergency sources look populated — keep reviewing them as facilities change.
          </p>
        )}

        <ul className="grid gap-3 sm:grid-cols-2">
          {HUB_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex h-full flex-col rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm transition hover:border-ds-primary/40"
              >
                <h3 className="font-semibold text-ds-foreground">{link.title}</h3>
                <p className="mt-1 text-sm text-ds-muted">{link.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </PageBody>
    </div>
  );
}
