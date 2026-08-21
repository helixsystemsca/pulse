"use client";

import Link from "next/link";
import { CalendarRange, FolderKanban, Map, Wallet, Wrench } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";

const LINKS = [
  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
    description: "Active execution projects, tasks, and health.",
  },
  {
    title: "Roadmap",
    href: "/roadmap",
    icon: Map,
    description: "Portfolio timeline, milestones, and budget fields.",
  },
  {
    title: "Planning ideas",
    href: "/planning",
    icon: CalendarRange,
    description: "Ideas and estimated costs before they become projects.",
  },
  {
    title: "PM workspace",
    href: "/dashboard/pm-workspace",
    icon: Wrench,
    description: "Coordination projects and PM risk register.",
  },
  {
    title: "Maintenance work orders",
    href: "/dashboard/maintenance",
    icon: Wrench,
    description: "Overdue and preventative work requests.",
  },
  {
    title: "Budget signals",
    href: "/roadmap",
    icon: Wallet,
    description: "No dedicated ledger yet — roadmap budgets and purchasing via inventory.",
  },
  {
    title: "Team risks",
    href: "/recreation/team-development",
    icon: FolderKanban,
    description: "Staffing / skill risks (Phase 2 Team Development).",
  },
];

export default function PlanningHubPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Planning Hub"
        description="Personal planning layer over Projects, Roadmap, PM workspace, Maintenance, and budget signals — without replacing those modules."
        icon={Map}
      />
      <PageBody>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <li key={link.href + link.title}>
                <Link
                  href={link.href}
                  className="flex h-full flex-col rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm transition hover:border-ds-primary/40"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ds-primary/10 text-ds-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-semibold text-ds-foreground">{link.title}</h3>
                  <p className="mt-1 text-sm text-ds-muted">{link.description}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </PageBody>
    </div>
  );
}
