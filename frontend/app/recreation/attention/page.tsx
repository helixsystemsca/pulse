"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  CalendarRange,
  ClipboardCheck,
  FolderKanban,
  Package,
  ShieldAlert,
  Siren,
  Wallet,
  Wrench,
} from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { CertificationExpiryPanel } from "@/components/recreation/CertificationExpiryPanel";
import { fetchIntelligence, type OpsIntelligence } from "@/lib/recreation/commandService";

const MODULES: {
  key: keyof OpsIntelligence;
  label: string;
  href: string;
  icon: typeof Wrench;
  blurb: string;
}[] = [
  {
    key: "assets",
    label: "Assets",
    href: "/equipment",
    icon: Wrench,
    blurb: "PM overdue parts and equipment in maintenance.",
  },
  {
    key: "inventory",
    label: "Inventory",
    href: "/dashboard/inventory",
    icon: Package,
    blurb: "Below-minimum stock from Pulse inventory.",
  },
  {
    key: "procedures",
    label: "Procedures / SOPs",
    href: "/standards/procedures",
    icon: BookOpen,
    blurb: "Critical active SOPs from CMMS procedures.",
  },
  {
    key: "training",
    label: "Training",
    href: "/training/compliance/matrix",
    icon: ClipboardCheck,
    blurb: "Overdue / expired / due-soon assignments.",
  },
  {
    key: "compliance",
    label: "Compliance",
    href: "/standards/compliance",
    icon: ShieldAlert,
    blurb: "Missed compliance records and high-risk monitors.",
  },
  {
    key: "emergency",
    label: "Emergency Response",
    href: "/recreation/emergency",
    icon: Siren,
    blurb: "Readiness over facilities, contacts, and knowledge.",
  },
  {
    key: "projects",
    label: "Projects",
    href: "/projects",
    icon: FolderKanban,
    blurb: "Active projects, overdue tasks, roadmap behind schedule.",
  },
  {
    key: "planning_risks",
    label: "Planning risks",
    href: "/dashboard/pm-workspace",
    icon: AlertTriangle,
    blurb: "PM coordination risks and open project issues (not team risks).",
  },
  {
    key: "budget",
    label: "Budget",
    href: "/recreation/planning",
    icon: Wallet,
    blurb: "Roadmap budgets and planning cost placeholders — no spend ledger yet.",
  },
  {
    key: "maintenance",
    label: "Maintenance WOs",
    href: "/dashboard/maintenance",
    icon: CalendarRange,
    blurb: "Overdue work requests and open preventative orders.",
  },
  {
    key: "certifications",
    label: "Certifications",
    href: "/training/compliance/workers?panel=certifications",
    icon: ClipboardCheck,
    blurb: "Employee certs expired or due in 30 / 60 / 90 days (in-app).",
  },
  {
    key: "contractors",
    label: "Contractors",
    href: "/recreation/contractors",
    icon: Wrench,
    blurb: "Insurance, WCB, or tickets expired or due soon.",
  },
];

function countFor(key: keyof OpsIntelligence, data: OpsIntelligence): number {
  const t = data.totals || {};
  switch (key) {
    case "assets":
      return t.assets_needing_attention ?? 0;
    case "inventory":
      return t.inventory_low_stock ?? 0;
    case "training":
      return t.training_overdue ?? 0;
    case "compliance":
      return t.compliance_missed ?? 0;
    case "procedures":
      return t.critical_procedures ?? 0;
    case "emergency":
      return t.emergency_readiness_gaps ?? 0;
    case "projects":
      return (t.overdue_project_tasks ?? 0) + (t.roadmap_behind ?? 0);
    case "planning_risks":
      return t.pm_coord_risks ?? 0;
    case "budget":
      return t.roadmap_with_budget ?? 0;
    case "maintenance":
      return t.overdue_work_requests ?? 0;
    case "certifications":
      return (t.certs_expired ?? 0) + (t.certs_expiring_90 ?? 0);
    case "contractors":
      return t.contractor_attention ?? 0;
    default:
      return 0;
  }
}

export default function AttentionPage() {
  const [data, setData] = useState<OpsIntelligence | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchIntelligence()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load attention"));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Attention"
        description="Cross-module attention — operations intelligence (Phase 3) plus planning (Phase 4). Links to existing systems of record."
        icon={AlertTriangle}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {!data && !error ? <p className="text-sm text-ds-muted">Loading…</p> : null}

        {data ? (
          <>
            <ul className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {MODULES.map((m) => {
                const Icon = m.icon;
                const n = countFor(m.key, data);
                return (
                  <li key={String(m.key)}>
                    <Link
                      href={m.href}
                      className="flex h-full flex-col rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm transition hover:border-ds-primary/40"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ds-primary/10 text-ds-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span
                          className={`text-2xl font-semibold tabular-nums ${n > 0 ? "text-amber-800" : "text-ds-foreground"}`}
                        >
                          {n}
                        </span>
                      </span>
                      <h3 className="mt-3 font-semibold text-ds-foreground">{m.label}</h3>
                      <p className="mt-1 text-sm text-ds-muted">{m.blurb}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <CertificationExpiryPanel />
            <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ds-muted">Priority items</h2>
            {data.attention_items.length ? (
              <ul className="space-y-2">
                {data.attention_items.map((item, idx) => (
                  <li key={idx}>
                    <Link
                      href={item.href}
                      className="block rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
                    >
                      <span className="font-medium text-ds-foreground">{item.title}</span>
                      <span className="mt-0.5 block text-xs text-ds-muted">
                        {item.kind} · {item.priority}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ds-muted">No cross-module attention items right now.</p>
            )}
          </>
        ) : null}
      </PageBody>
    </div>
  );
}
