"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  CheckSquare,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
  Network,
  ScrollText,
  Siren,
  User,
  Users,
  Wrench,
  GraduationCap,
  AlertTriangle,
  FolderKanban,
  FileText,
} from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { OPS_MODULES } from "@/lib/recreation/ops-modules";
import {
  fetchCommandDashboard,
  type OpsCommandDashboard,
} from "@/lib/recreation/commandService";

const ICONS = {
  "book-open": BookOpen,
  users: Users,
  wrench: Wrench,
  "scroll-text": ScrollText,
  building: Building2,
  clipboard: ClipboardList,
  megaphone: Megaphone,
} as const;

function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number | string;
  href?: string;
  tone?: "default" | "warn" | "good";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-300/80 bg-amber-50 text-amber-950"
      : tone === "good"
        ? "border-emerald-300/80 bg-emerald-50 text-emerald-950"
        : "border-ds-border bg-ds-card text-ds-foreground";
  const inner = (
    <div className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block transition hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export default function RecreationHomePage() {
  const [dash, setDash] = useState<OpsCommandDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchCommandDashboard()
      .then(setDash)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load dashboard"));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="What do I need to do today? Personal recreation ops attention — checklists, knowledge gaps, and quick access to your operating system."
        icon={LayoutDashboard}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}

        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/recreation/me"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <User className="h-4 w-4 text-ds-primary" />
            My Profile
          </Link>
          <Link
            href="/recreation/checklists"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <CheckSquare className="h-4 w-4 text-ds-primary" />
            Checklists
          </Link>
          <Link
            href="/recreation/knowledge-gaps"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <HelpCircle className="h-4 w-4 text-ds-primary" />
            Knowledge Gaps
          </Link>
          <Link
            href="/recreation/org-chart"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <Network className="h-4 w-4 text-ds-primary" />
            Org Chart
          </Link>
          <Link
            href="/recreation/team-development"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <GraduationCap className="h-4 w-4 text-ds-primary" />
            Team Development
          </Link>
          <Link
            href="/recreation/attention"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <AlertTriangle className="h-4 w-4 text-ds-primary" />
            Attention
          </Link>
          <Link
            href="/recreation/emergency"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <Siren className="h-4 w-4 text-ds-primary" />
            Emergency
          </Link>
          <Link
            href="/recreation/planning"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <FolderKanban className="h-4 w-4 text-ds-primary" />
            Planning
          </Link>
          <Link
            href="/recreation/reports"
            className="inline-flex items-center gap-2 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
          >
            <FileText className="h-4 w-4 text-ds-primary" />
            Reports
          </Link>
        </div>

        {dash ? (
          <>
            <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard
                label="Overdue items"
                value={dash.checklist_overdue}
                href="/recreation/checklists"
                tone={dash.checklist_overdue > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Due today"
                value={dash.checklist_due_today}
                href="/recreation/checklists"
                tone={dash.checklist_due_today > 0 ? "warn" : "default"}
              />
              <StatCard
                label="Open knowledge gaps"
                value={dash.knowledge_gaps_open}
                href="/recreation/knowledge-gaps"
                tone={dash.knowledge_gaps_high > 0 ? "warn" : "default"}
              />
              <StatCard
                label="Authority to confirm"
                value={dash.authority_unknown}
                href="/recreation/me"
                tone={dash.authority_unknown > 0 ? "warn" : "good"}
              />
              <StatCard
                label="People in ops directory"
                value={dash.people_count ?? 0}
                href="/recreation/org-chart"
              />
              <StatCard
                label="Open team risks"
                value={dash.open_team_risks ?? 0}
                href="/recreation/team-development"
                tone={(dash.open_team_risks ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Assets needing attention"
                value={dash.assets_needing_attention ?? 0}
                href="/equipment"
                tone={(dash.assets_needing_attention ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Low stock"
                value={dash.inventory_low_stock ?? 0}
                href="/dashboard/inventory"
                tone={(dash.inventory_low_stock ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Training overdue"
                value={dash.training_overdue ?? 0}
                href="/training/compliance/matrix"
                tone={(dash.training_overdue ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Compliance missed"
                value={dash.compliance_missed ?? 0}
                href="/standards/compliance"
                tone={(dash.compliance_missed ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Emergency gaps"
                value={dash.emergency_readiness_gaps ?? 0}
                href="/recreation/emergency"
                tone={(dash.emergency_readiness_gaps ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Overdue project tasks"
                value={dash.overdue_project_tasks ?? 0}
                href="/projects"
                tone={(dash.overdue_project_tasks ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Roadmap behind"
                value={dash.roadmap_behind ?? 0}
                href="/roadmap"
                tone={(dash.roadmap_behind ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="Overdue work orders"
                value={dash.overdue_work_requests ?? 0}
                href="/dashboard/maintenance"
                tone={(dash.overdue_work_requests ?? 0) > 0 ? "warn" : "good"}
              />
              <StatCard
                label="PM / planning risks"
                value={dash.pm_coord_risks ?? 0}
                href="/dashboard/pm-workspace"
                tone={(dash.pm_coord_risks ?? 0) > 0 ? "warn" : "default"}
              />
            </div>

            {!dash.profile_complete ? (
              <div className="mb-6 rounded-xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Complete your{" "}
                <Link href="/recreation/me" className="font-medium underline">
                  profile, role purpose, and principles
                </Link>{" "}
                so the Command Center reflects how you operate.
              </div>
            ) : null}

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ds-muted">My Today</h2>
                {dash.due_items.length ? (
                  <ul className="space-y-2">
                    {dash.due_items.slice(0, 8).map((item, idx) => (
                      <li key={idx}>
                        <Link
                          href={String(item.href || "/recreation")}
                          className="block rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
                        >
                          <span className="font-medium text-ds-foreground">{String(item.title)}</span>
                          <span className="mt-0.5 block text-xs text-ds-muted">
                            {String(item.kind)}
                            {item.priority ? ` · ${String(item.priority)}` : ""}
                            {item.due_date ? ` · due ${String(item.due_date)}` : ""}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ds-muted">Nothing overdue or due today. Start a checklist or log a gap.</p>
                )}
              </section>

              <section>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ds-muted">Active checklists</h2>
                {dash.active_checklist_summaries.length ? (
                  <ul className="space-y-2">
                    {dash.active_checklist_summaries.map((c) => (
                      <li key={c.id}>
                        <Link
                          href={`/recreation/checklists?id=${c.id}`}
                          className="block rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{c.title}</span>
                            <span className="text-xs text-ds-muted">{c.progress_pct}%</span>
                          </div>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ds-border">
                            <div
                              className="h-full rounded-full bg-ds-primary"
                              style={{ width: `${c.progress_pct}%` }}
                            />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ds-muted">
                    No active checklists.{" "}
                    <Link href="/recreation/checklists" className="underline">
                      Start First 30 Days
                    </Link>
                    .
                  </p>
                )}
              </section>
            </div>

            <section className="mb-8">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ds-muted">
                  Operational attention
                </h2>
                <Link href="/recreation/attention" className="text-xs text-ds-primary underline">
                  View all
                </Link>
              </div>
              {(dash.intelligence_items ?? []).length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {(dash.intelligence_items ?? []).slice(0, 6).map((item, idx) => (
                    <li key={idx}>
                      <Link
                        href={String(item.href || "/recreation/attention")}
                        className="block rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
                      >
                        <span className="font-medium text-ds-foreground">{String(item.title)}</span>
                        <span className="mt-0.5 block text-xs text-ds-muted">
                          {String(item.kind)}
                          {item.priority ? ` · ${String(item.priority)}` : ""}
                          {item.detail ? ` · ${String(item.detail)}` : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ds-muted">
                  No cross-module alerts. Open{" "}
                  <Link href="/recreation/attention" className="underline">
                    Operational Attention
                  </Link>{" "}
                  for assets, inventory, training, and compliance.
                </p>
              )}
            </section>

            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ds-muted">Open knowledge gaps</h2>
              {dash.open_gaps.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {dash.open_gaps.slice(0, 6).map((g) => (
                    <li key={g.id}>
                      <Link
                        href="/recreation/knowledge-gaps"
                        className="block rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm hover:border-ds-primary/40"
                      >
                        <span className="line-clamp-2 font-medium text-ds-foreground">{g.question}</span>
                        <span className="mt-0.5 block text-xs text-ds-muted">
                          {g.category} · {g.priority}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ds-muted">No open gaps — capture questions as you find them.</p>
              )}
            </section>
          </>
        ) : !error ? (
          <p className="mb-8 text-sm text-ds-muted">Loading command center…</p>
        ) : null}

        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ds-muted">Ops modules</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OPS_MODULES.map((mod) => {
            const Icon = ICONS[mod.icon as keyof typeof ICONS] ?? ClipboardList;
            return (
              <li key={mod.entityType}>
                <Link
                  href={mod.route}
                  className="flex h-full flex-col rounded-xl border border-ds-border bg-ds-card p-4 shadow-sm transition hover:border-ds-primary/40 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ds-primary/10 text-ds-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-3 font-semibold text-ds-foreground">{mod.label}</h3>
                  <p className="mt-1 text-sm text-ds-muted">{mod.description}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </PageBody>
    </div>
  );
}
