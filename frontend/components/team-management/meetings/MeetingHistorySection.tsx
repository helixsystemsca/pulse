"use client";

import { History, Loader2 } from "lucide-react";
import { useMemo } from "react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { MeetingRecordCard } from "@/components/team-management/meetings/shared/MeetingRecordCard";
import { useTeamMeetings } from "@/lib/team-management/hooks/useTeamMeetings";

export function MeetingHistorySection() {
  const { meetings, loading, error } = useTeamMeetings();

  const history = useMemo(
    () =>
      meetings
        .filter((m) => m.status === "completed" || m.status === "cancelled")
        .sort((a, b) => (b.scheduled_date || b.updated_at).localeCompare(a.scheduled_date || a.updated_at)),
    [meetings],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meeting History"
        description="Completed and cancelled meetings across your team."
        icon={History}
      />
      <PageBody>
        {loading ? (
          <div className="flex min-h-[10rem] items-center justify-center text-ds-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-sm text-ds-danger">{error}</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-ds-muted">No completed meetings yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {history.map((m) => (
              <MeetingRecordCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </PageBody>
    </div>
  );
}
