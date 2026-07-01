"use client";

import { Calendar, User } from "lucide-react";
import type { WorkerMeeting } from "@/lib/team-management/employee-profile/types";
import { formatShortDate } from "@/lib/team-management/development-types";
import { MeetingStatusBadge } from "@/components/team-management/meetings/shared/MeetingStatusBadge";
import { Button } from "@/components/ui/Button";

export function MeetingRecordCard({
  meeting,
  onOpen,
}: {
  meeting: WorkerMeeting;
  onOpen?: (meeting: WorkerMeeting) => void;
}) {
  return (
    <article className="ops-dash-inner-card flex flex-col gap-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ds-foreground">
            <User className="h-3.5 w-3.5 shrink-0 text-ds-muted" aria-hidden />
            <span className="truncate">{meeting.employee_name || "Employee"}</span>
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ds-muted">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {formatShortDate(meeting.scheduled_date)}
            {meeting.next_meeting_date ? (
              <span> · Next {formatShortDate(meeting.next_meeting_date)}</span>
            ) : null}
          </p>
        </div>
        <MeetingStatusBadge status={meeting.status} />
      </div>
      {meeting.agenda ? (
        <p className="line-clamp-2 text-xs text-ds-muted">{meeting.agenda}</p>
      ) : (
        <p className="text-xs italic text-ds-muted">No agenda set</p>
      )}
      {meeting.action_items.length > 0 ? (
        <p className="text-[10px] font-semibold text-ds-muted">
          {meeting.action_items.length} action item{meeting.action_items.length === 1 ? "" : "s"}
        </p>
      ) : null}
      {onOpen ? (
        <Button type="button" variant="secondary" className="mt-1 h-8 w-fit text-xs" onClick={() => onOpen(meeting)}>
          Open Record
        </Button>
      ) : null}
    </article>
  );
}
