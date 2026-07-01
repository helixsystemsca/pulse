"use client";

import Link from "next/link";
import { ArrowRight, Loader2, MessageSquare } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { TeamSectionSubNav } from "@/components/team-management/shared/TeamSectionSubNav";
import { MEETINGS_SUB_NAV } from "@/lib/team-management/navigation";
import { useTeamMeetings } from "@/lib/team-management/hooks/useTeamMeetings";
import { cn } from "@/lib/cn";

export function MeetingsHubSection() {
  const { meetings, actionItems, loading } = useTeamMeetings();
  const upcoming = meetings.filter((m) => m.status === "upcoming");
  const openActions = actionItems.filter((i) => i.status === "open" || i.status === "in_progress");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meetings"
        description="One-on-ones, team meetings, action items, and meeting history — structured for future calendar integration."
        icon={MessageSquare}
      />
      <TeamSectionSubNav items={MEETINGS_SUB_NAV} ariaLabel="Meetings sections" />
      <PageBody>
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center text-ds-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="ops-dash-inner-card px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-ds-muted">Upcoming</p>
              <p className="text-xl font-bold tabular-nums">{upcoming.length}</p>
            </div>
            <div className="ops-dash-inner-card px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-ds-muted">Open Actions</p>
              <p className="text-xl font-bold tabular-nums">{openActions.length}</p>
            </div>
            <div className="ops-dash-inner-card px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-ds-muted">Total Meetings</p>
              <p className="text-xl font-bold tabular-nums">{meetings.length}</p>
            </div>
            <div className="ops-dash-inner-card px-3 py-2">
              <p className="text-[10px] font-bold uppercase text-ds-muted">Completed</p>
              <p className="text-xl font-bold tabular-nums">
                {meetings.filter((m) => m.status === "completed").length}
              </p>
            </div>
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MEETINGS_SUB_NAV.filter((item) => !item.future).map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "ops-dash-inner-card group flex flex-col p-4 transition-shadow",
                "hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.18)]",
              )}
            >
              <h2 className="text-sm font-bold text-ds-foreground">{item.label}</h2>
              <p className="mt-1 flex-1 text-xs text-ds-muted">
                {item.id === "coordination"
                  ? "Leadership follow-ups, handoffs, and action items."
                  : item.id === "one-on-ones"
                    ? "Schedule and track recurring manager–employee meetings."
                    : item.id === "action-items"
                      ? "Open follow-ups from meetings across your team."
                      : item.id === "notes"
                        ? "Completed and cancelled meeting records."
                        : "Meetings workspace overview."}
              </p>
              <ArrowRight
                className="mt-3 h-4 w-4 text-ds-muted transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--ds-accent)]"
                aria-hidden
              />
            </Link>
          ))}
          {MEETINGS_SUB_NAV.filter((item) => item.future).map((item) => (
            <div key={item.id} className="ops-dash-inner-card flex flex-col border-dashed p-4 opacity-70">
              <h2 className="text-sm font-bold text-ds-foreground">{item.label}</h2>
              <p className="mt-1 text-xs text-ds-muted">Structured for Outlook / Google Calendar sync.</p>
            </div>
          ))}
        </div>
      </PageBody>
    </div>
  );
}
