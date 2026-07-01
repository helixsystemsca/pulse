"use client";

import { Loader2, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { MeetingFormDrawer } from "@/components/team-management/meetings/shared/MeetingFormDrawer";
import { MeetingRecordCard } from "@/components/team-management/meetings/shared/MeetingRecordCard";
import { useTeamMeetings } from "@/lib/team-management/hooks/useTeamMeetings";

export function TeamMeetingsSection() {
  const { meetings, loading, error, reload } = useTeamMeetings();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const teamMeetings = useMemo(
    () =>
      meetings
        .filter((m) => m.meeting_type === "team")
        .sort((a, b) => (b.scheduled_date || "").localeCompare(a.scheduled_date || "")),
    [meetings],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Meetings"
        description="Group meetings and standups. Calendar sync hooks reserved for Outlook / Google."
        icon={Users}
        actions={
          <Button type="button" className="h-9 gap-1.5 text-xs" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Log Team Meeting
          </Button>
        }
      />
      <PageBody>
        {loading ? (
          <div className="flex min-h-[10rem] items-center justify-center text-ds-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-sm text-ds-danger">{error}</p>
        ) : teamMeetings.length === 0 ? (
          <p className="text-sm text-ds-muted">No team meetings logged yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {teamMeetings.map((m) => (
              <MeetingRecordCard key={m.id} meeting={m} />
            ))}
          </div>
        )}
      </PageBody>
      <MeetingFormDrawer
        open={drawerOpen}
        defaultMeetingType="team"
        onClose={() => setDrawerOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
