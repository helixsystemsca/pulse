"use client";

import { CheckSquare, Loader2 } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { MeetingStatusBadge } from "@/components/team-management/meetings/shared/MeetingStatusBadge";
import { useTeamMeetings } from "@/lib/team-management/hooks/useTeamMeetings";
import { formatShortDate } from "@/lib/team-management/development-types";

export function ActionItemsSection() {
  const { actionItems, loading, error } = useTeamMeetings();

  const openItems = actionItems.filter((i) => i.status === "open" || i.status === "in_progress");
  const sorted = [...actionItems].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Action Items"
        description="Follow-ups from one-on-ones and team meetings. Designed for future project integration."
        icon={CheckSquare}
      />
      <PageBody>
        {loading ? (
          <div className="flex min-h-[10rem] items-center justify-center text-ds-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-sm text-ds-danger">{error}</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-ds-muted">No action items yet. They are created from meeting records.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-ds-muted">
              {openItems.length} open · {sorted.length} total
            </p>
            <ul className="space-y-2">
              {sorted.map((item) => (
                <li key={item.id} className="ops-dash-inner-card flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ds-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs text-ds-muted">
                      Assigned to {item.assigned_to_name || "Unassigned"}
                      {item.due_date ? ` · Due ${formatShortDate(item.due_date)}` : ""}
                    </p>
                    {item.notes ? <p className="mt-1 text-xs text-ds-muted">{item.notes}</p> : null}
                    {item.project_id ? (
                      <p className="mt-1 text-[10px] text-ds-muted">Project hook: {item.project_id}</p>
                    ) : null}
                  </div>
                  <MeetingStatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </PageBody>
    </div>
  );
}
