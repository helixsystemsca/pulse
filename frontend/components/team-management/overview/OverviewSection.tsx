"use client";

import Link from "next/link";
import { ArrowRight, LayoutDashboard, Loader2 } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { OverviewWidget } from "@/components/team-management/overview/components/OverviewWidget";
import {
  upcomingAnniversaries,
  useTeamOverviewData,
} from "@/lib/team-management/hooks/useTeamOverviewData";
import { useTeamLeadershipInsights } from "@/lib/team-management/hooks/useTeamLeadershipInsights";
import { QUADRANT_META, STATUS_META, formatShortDate } from "@/lib/team-management/development-types";
import { cn } from "@/lib/cn";

export function OverviewSection() {
  const {
    quadrantCounts,
    reviewsDue,
    developmentMilestones,
    onTrackCount,
    needsAttentionCount,
    loading,
    error,
    employees,
    developmentByUserId,
  } = useTeamOverviewData();

  const devRows = [...developmentByUserId.values()].filter((d) => d.is_active);
  const anniversaries = upcomingAnniversaries(devRows, 30);
  const activeCount = employees.filter((e) => e.is_active).length;
  const { recognition, attention, leadershipTasks, loading: insightsLoading } = useTeamLeadershipInsights(devRows);

  const pageLoading = loading || insightsLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Management"
        description="Your manager workspace — people health, performance, growth, and what needs attention today."
        icon={LayoutDashboard}
      />
      <PageBody>
        {pageLoading ? (
          <div className="flex min-h-[12rem] items-center justify-center text-ds-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-sm text-ds-danger">{error}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <OverviewWidget title="Team Health" className="xl:col-span-1">
              <div className="grid grid-cols-2 gap-2">
                {(["A", "B", "C", "D"] as const).map((q) => (
                  <div
                    key={q}
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      QUADRANT_META[q].bgClass,
                      QUADRANT_META[q].borderClass,
                    )}
                  >
                    <p className={cn("text-[10px] font-bold", QUADRANT_META[q].textClass)}>
                      {q} Players
                    </p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-ds-foreground">{quadrantCounts[q]}</p>
                  </div>
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ds-border/50 pt-3 text-xs">
                <div>
                  <dt className="text-ds-muted">Active team</dt>
                  <dd className="font-bold tabular-nums">{activeCount}</dd>
                </div>
                <div>
                  <dt className="text-ds-muted">On track</dt>
                  <dd className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{onTrackCount}</dd>
                </div>
              </dl>
              <Link
                href="/team-management/performance"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ds-accent)]"
              >
                Open Performance <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </OverviewWidget>

            <OverviewWidget title="Attention Required" className="lg:col-span-2 xl:col-span-1">
              <ul className="space-y-2 text-xs">
                <li className="flex justify-between gap-2">
                  <span className="text-ds-muted">Reviews due (30d)</span>
                  <span className="font-bold tabular-nums">{attention.reviewsDue.length}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-ds-muted">Needs support / action</span>
                  <span className="font-bold tabular-nums">{attention.actionRequired.length}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-ds-muted">Upcoming meetings</span>
                  <span className="font-bold tabular-nums">{attention.upcomingMeetings.length}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-ds-muted">Without assessment</span>
                  <span className="font-bold tabular-nums">{attention.noAssessment.length}</span>
                </li>
                <li className="flex justify-between gap-2">
                  <span className="text-ds-muted">Training expiring</span>
                  <span className="font-bold tabular-nums text-ds-muted">—</span>
                </li>
              </ul>
              {attention.noAssessment.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-ds-border/50 pt-2">
                  {attention.noAssessment.slice(0, 3).map((row) => (
                    <li key={row.user_id} className="truncate text-xs font-medium text-ds-foreground">
                      {row.full_name || row.email}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link
                href="/team-management/people"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ds-accent)]"
              >
                View People <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </OverviewWidget>

            <OverviewWidget title="Today's Leadership Tasks" className="lg:col-span-2">
              {leadershipTasks.length === 0 ? (
                <p className="text-sm text-ds-muted">No leadership tasks scheduled for the next two weeks.</p>
              ) : (
                <ul className="space-y-2">
                  {leadershipTasks.map((task) => (
                    <li key={task.id} className="flex justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-ds-foreground">{task.title}</span>
                        {task.subtitle ? <span className="text-ds-muted"> · {task.subtitle}</span> : null}
                      </span>
                      <span className="shrink-0 tabular-nums text-ds-muted">{formatShortDate(task.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/team-management/meetings"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ds-accent)]"
              >
                Meetings <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </OverviewWidget>

            <OverviewWidget title="Recognition Feed">
              {recognition.length === 0 ? (
                <p className="text-sm text-ds-muted">No recognition recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {recognition.slice(0, 6).map((row) => (
                    <li key={row.id} className="text-xs">
                      <p className="font-semibold text-ds-foreground">{row.employee_name}</p>
                      <p className="text-ds-foreground">{row.title}</p>
                      <p className="mt-0.5 text-[10px] capitalize text-ds-muted">
                        {row.category.replace(/_/g, " ")} · {formatShortDate(row.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </OverviewWidget>

            <OverviewWidget title="Reviews Due">
              {reviewsDue.length === 0 ? (
                <p className="text-sm text-ds-muted">No reviews due in the next 30 days.</p>
              ) : (
                <ul className="space-y-2">
                  {reviewsDue.slice(0, 5).map((row) => (
                    <li key={row.user_id} className="flex justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-ds-foreground">
                        {row.full_name || row.email}
                      </span>
                      <span className="shrink-0 tabular-nums text-ds-muted">
                        {formatShortDate(row.next_review_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </OverviewWidget>

            <OverviewWidget title="Upcoming One-on-Ones">
              {attention.upcomingMeetings.length === 0 ? (
                <p className="text-sm text-ds-muted">No upcoming one-on-ones scheduled.</p>
              ) : (
                <ul className="space-y-2">
                  {attention.upcomingMeetings.slice(0, 5).map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-ds-foreground">
                        {m.employee_name || "Employee"}
                      </span>
                      <span className="shrink-0 tabular-nums text-ds-muted">
                        {formatShortDate(m.scheduled_date)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/team-management/meetings/one-on-ones"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ds-accent)]"
              >
                Schedule 1:1 <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </OverviewWidget>

            <OverviewWidget title="Work Anniversaries">
              {anniversaries.length === 0 ? (
                <p className="text-sm text-ds-muted">No anniversaries in the next 30 days.</p>
              ) : (
                <ul className="space-y-2">
                  {anniversaries.slice(0, 5).map(({ row, days }) => (
                    <li key={row.user_id} className="flex justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-ds-foreground">
                        {row.full_name || row.email}
                      </span>
                      <span className="shrink-0 text-ds-muted">
                        {days === 0 ? "Today" : `In ${days}d`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </OverviewWidget>

            <OverviewWidget title="Development Milestones" className="lg:col-span-2 xl:col-span-1">
              {developmentMilestones.length === 0 ? (
                <p className="text-sm text-ds-muted">No upcoming milestones in the next 90 days.</p>
              ) : (
                <ul className="space-y-2">
                  {developmentMilestones.map((m) => (
                    <li key={m.id} className="flex justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-ds-foreground">{m.employeeName}</span>
                        <span className="text-ds-muted"> · {m.title}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-ds-muted">
                        {formatShortDate(m.scheduledDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/team-management/performance"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--ds-accent)]"
              >
                Development plans <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </OverviewWidget>

            <OverviewWidget title="Status Snapshot">
              <ul className="space-y-1.5 text-xs">
                {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((key) => {
                  const count = devRows.filter((r) => r.development_status === key).length;
                  if (!count) return null;
                  return (
                    <li key={key} className="flex justify-between gap-2">
                      <span className="text-ds-muted">{STATUS_META[key].label}</span>
                      <span className="font-bold tabular-nums">{count}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-ds-muted">
                {needsAttentionCount} employee{needsAttentionCount === 1 ? "" : "s"} need attention
              </p>
            </OverviewWidget>
          </div>
        )}
      </PageBody>
    </div>
  );
}
