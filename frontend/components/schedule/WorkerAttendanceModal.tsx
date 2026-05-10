"use client";

import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import type { WorkerDayAttendanceMark } from "@/lib/dashboard/worker-day-attendance-store";
import { useWorkerDayAttendanceStore, workerDayAttendanceKey } from "@/lib/dashboard/worker-day-attendance-store";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  open: boolean;
  onClose: () => void;
  workerId: string;
  date: string;
  workerLabel: string;
};

export function WorkerAttendanceModal({ open, onClose, workerId, date, workerLabel }: Props) {
  const setMark = useWorkerDayAttendanceStore((s) => s.setMark);
  const current = useWorkerDayAttendanceStore((s) => s.marks[workerDayAttendanceKey(workerId, date)]);

  function apply(mark: WorkerDayAttendanceMark | null) {
    setMark(workerId, date, mark);
    onClose();
  }

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      placement="center"
      title="Attendance"
      subtitle={`${workerLabel} · ${date}`}
      footer={
        <button type="button" className={buttonVariants({ surface: "light", intent: "secondary" })} onClick={onClose}>
          Cancel
        </button>
      }
    >
      <div className="space-y-3 px-1">
        <p className="text-sm text-ds-muted">
          Mark appears on the operations workforce widget for today. Telemetry can replace this later.
        </p>
        {current ? (
          <p className="text-xs font-semibold text-ds-foreground">
            Current: <span className="uppercase">{current === "dns" ? "Did not show" : "Sick"}</span>
          </p>
        ) : null}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            className={cn(
              buttonVariants({ surface: "light", intent: "accent" }),
              "justify-center bg-[#e8706f] text-white hover:bg-[#d85f5c] dark:bg-[#e8706f] dark:hover:bg-[#f08078]",
            )}
            onClick={() => apply("sick")}
          >
            Sick
          </button>
          <button
            type="button"
            className={cn(
              buttonVariants({ surface: "light", intent: "accent" }),
              "justify-center bg-[#e8706f] text-white hover:bg-[#d85f5c] dark:bg-[#e8706f] dark:hover:bg-[#f08078]",
            )}
            onClick={() => apply("dns")}
          >
            Did not show (DNS)
          </button>
          <button
            type="button"
            className={buttonVariants({ surface: "light", intent: "secondary" })}
            onClick={() => apply(null)}
          >
            Clear mark
          </button>
        </div>
      </div>
    </PulseDrawer>
  );
}
