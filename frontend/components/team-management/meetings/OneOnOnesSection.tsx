"use client";

import { Loader2, Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { MeetingFormDrawer } from "@/components/team-management/meetings/shared/MeetingFormDrawer";
import { MeetingRecordCard } from "@/components/team-management/meetings/shared/MeetingRecordCard";
import { useTeamMeetings } from "@/lib/team-management/hooks/useTeamMeetings";
import type { WorkerMeeting } from "@/lib/team-management/employee-profile/types";

export function OneOnOnesSection() {
  const { meetings, loading, error, reload } = useTeamMeetings();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<WorkerMeeting | null>(null);

  const oneOnOnes = useMemo(
    () =>
      meetings
        .filter((m) => m.meeting_type === "one_on_one")
        .sort((a, b) => (b.scheduled_date || "").localeCompare(a.scheduled_date || "")),
    [meetings],
  );

  const upcoming = oneOnOnes.filter((m) => m.status === "upcoming");

  return (
    <div className="space-y-6">
      <PageHeader
        title="One-on-Ones"
        description="Recurring manager–employee meetings tied to each employee profile."
        icon={UserRound}
        actions={
          <Button type="button" className="h-9 gap-1.5 text-xs" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Schedule 1:1
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
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-ds-muted">
                Upcoming ({upcoming.length})
              </h2>
              {upcoming.length === 0 ? (
                <p className="mt-2 text-sm text-ds-muted">No upcoming one-on-ones scheduled.</p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {upcoming.map((m) => (
                    <MeetingRecordCard
                      key={m.id}
                      meeting={m}
                      onOpen={(row) => {
                        setEditing(row);
                        setDrawerOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
            <section>
              <h2 className="text-xs font-bold uppercase tracking-wide text-ds-muted">All One-on-Ones</h2>
              {oneOnOnes.length === 0 ? (
                <p className="mt-2 text-sm text-ds-muted">No meeting records yet.</p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {oneOnOnes.map((m) => (
                    <MeetingRecordCard
                      key={m.id}
                      meeting={m}
                      onOpen={(row) => {
                        setEditing(row);
                        setDrawerOpen(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </PageBody>
      <MeetingFormDrawer
        open={drawerOpen}
        meeting={editing}
        defaultMeetingType="one_on_one"
        onClose={() => {
          setDrawerOpen(false);
          setEditing(null);
        }}
        onSaved={() => void reload()}
      />
    </div>
  );
}
