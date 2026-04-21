"use client";

import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { WorkerProfile } from "@/components/team/WorkerProfile";

export function WorkerProfileModal({
  userId,
  open,
  onClose,
}: {
  userId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      title="Worker Profile"
      subtitle={userId ? "XP, streaks, badges, and recent wins." : undefined}
      placement="center"
      wide
    >
      {userId ? <WorkerProfile userId={userId} mode="insights" /> : null}
    </PulseDrawer>
  );
}

