"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Award, Clock, Users } from "lucide-react";
import { WorkersQualificationView } from "@/components/standards/workforce-training/WorkersQualificationView";
import { CertificationsRegistryView } from "@/components/standards/workforce-training/CertificationsRegistryView";
import { ExpiringQualificationsView } from "@/components/standards/workforce-training/ExpiringQualificationsView";
import { cn } from "@/lib/cn";
import {
  TRAINING_ROUTES,
  trainingComplianceWorkersHref,
  type WorkforceQualificationPanel,
} from "@/lib/training/routes";

const PANELS: {
  id: WorkforceQualificationPanel;
  label: string;
  icon: typeof Users;
}[] = [
  { id: "people", label: "Workforce", icon: Users },
  { id: "certifications", label: "Certifications", icon: Award },
  { id: "queues", label: "Expiring & gaps", icon: Clock },
];

/** Workforce credentials hub — people, certification registry, and operational queues. */
export function WorkforceQualificationHub({ panel }: { panel: WorkforceQualificationPanel }) {
  const activePanel = useMemo(() => {
    if (PANELS.some((p) => p.id === panel)) return panel;
    return "people" as const;
  }, [panel]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight text-ds-foreground">Workforce</h2>
          <Link
            href={TRAINING_ROUTES.complianceMatrix}
            className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
          >
            ← Training matrix
          </Link>
        </div>
        <p className="max-w-3xl text-sm text-ds-muted">
          Employee certification records, the site registry, and expiring or deficient credentials. Procedure training
          readiness is on the compliance matrix.
        </p>
      </header>

      <nav
        className="flex flex-wrap gap-1 border-b border-ds-border pb-2"
        aria-label="Workforce sections"
      >
        {PANELS.map((t) => {
          const Icon = t.icon;
          const href = trainingComplianceWorkersHref(t.id);
          const isActive = activePanel === t.id;
          return (
            <Link
              key={t.id}
              href={href}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                isActive
                  ? "bg-ds-primary text-white"
                  : "text-ds-muted hover:bg-ds-muted/30 hover:text-ds-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>

      {activePanel === "people" ? <WorkersQualificationView /> : null}
      {activePanel === "certifications" ? <CertificationsRegistryView /> : null}
      {activePanel === "queues" ? <ExpiringQualificationsView /> : null}
    </div>
  );
}
