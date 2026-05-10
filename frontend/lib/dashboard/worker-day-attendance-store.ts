"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type WorkerDayAttendanceMark = "sick" | "dns";

export function workerDayAttendanceKey(workerId: string, date: string): string {
  return `${workerId}|${date}`;
}

type State = {
  marks: Record<string, WorkerDayAttendanceMark>;
  setMark: (workerId: string, date: string, mark: WorkerDayAttendanceMark | null) => void;
};

export const useWorkerDayAttendanceStore = create<State>()(
  persist(
    (set) => ({
      marks: {},
      setMark(workerId, date, mark) {
        const k = workerDayAttendanceKey(workerId, date);
        set((s) => {
          const next = { ...s.marks };
          if (mark == null) delete next[k];
          else next[k] = mark;
          return { marks: next };
        });
      },
    }),
    {
      name: "pulse_worker_day_attendance_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ marks: s.marks }),
    },
  ),
);
