"use client";

import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { GamificationWorkerProfile } from "@/components/gamification/GamificationWorkerProfile";

export function GamificationWorkerProfileModal({
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
      {userId ? <GamificationWorkerProfile userId={userId} mode="gamification" /> : null}
    </PulseDrawer>
  );
}
