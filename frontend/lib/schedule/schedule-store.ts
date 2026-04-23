"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getServerNow } from "@/lib/serverTime";
import {
  buildSeedShifts,
  defaultRoles,
  defaultSettings,
  defaultShiftTypes,
  defaultWorkers,
  defaultZones,
} from "./defaults";
import type {
  ScheduleRoleDefinition,
  ScheduleSettings,
  Shift,
  ShiftEventType,
  ShiftTypeConfig,
  TimeOffBlock,
  Worker,
  Zone,
} from "./types";

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type ScheduleState = {
  workers: Worker[];
  shifts: Shift[];
  zones: Zone[];
  roles: ScheduleRoleDefinition[];
  shiftTypes: ShiftTypeConfig[];
  settings: ScheduleSettings;
  pendingRequests: number;
  /** Mock / future hook: approved time-off blocks scheduling availability hints only. */
  timeOffBlocks: TimeOffBlock[];

  /** `eventType` defaults to `"work"` when omitted (backward-compatible). */
  addShift: (partial: Omit<Shift, "id" | "eventType"> & { eventType?: ShiftEventType }) => void;
  updateShift: (id: string, patch: Partial<Shift>) => void;
  deleteShift: (id: string) => void;

  addTimeOffBlock: (partial: Omit<TimeOffBlock, "id">) => void;
  removeTimeOffBlock: (id: string) => void;

  setWorkers: (workers: Worker[]) => void;
  setZones: (zones: Zone[]) => void;
  setRoles: (roles: ScheduleRoleDefinition[]) => void;
  setShiftTypes: (types: ShiftTypeConfig[]) => void;
  setSettings: (patch: Partial<ScheduleSettings>) => void;
  setPendingRequests: (n: number) => void;

  resetDemo: () => void;

  /** Replace roster + grid from Pulse API (live schedule). */
  applyPulseScheduleSnapshot: (workers: Worker[], zones: Zone[], shifts: Shift[]) => void;
};

function initialState(): Omit<
  ScheduleState,
  | "addShift"
  | "updateShift"
  | "deleteShift"
  | "setWorkers"
  | "setZones"
  | "setRoles"
  | "setShiftTypes"
  | "setSettings"
  | "setPendingRequests"
  | "addTimeOffBlock"
  | "removeTimeOffBlock"
  | "resetDemo"
  | "applyPulseScheduleSnapshot"
> {
  return {
    workers: defaultWorkers,
    shifts: buildSeedShifts(new Date(getServerNow())),
    zones: defaultZones,
    roles: defaultRoles,
    shiftTypes: defaultShiftTypes,
    settings: { ...defaultSettings },
    pendingRequests: 3,
    timeOffBlocks: [],
  };
}

export const useScheduleStore = create<ScheduleState>()(
  persist(
    (set, get) => ({
      ...initialState(),

      addShift: (partial) =>
        set((s) => ({
          shifts: [
            ...s.shifts,
            { ...partial, eventType: partial.eventType ?? "work", id: newId("shift") },
          ],
        })),

      updateShift: (id, patch) =>
        set((s) => ({
          shifts: s.shifts.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)),
        })),

      deleteShift: (id) =>
        set((s) => ({
          shifts: s.shifts.filter((sh) => sh.id !== id),
        })),

      addTimeOffBlock: (partial) =>
        set((s) => ({
          timeOffBlocks: [...s.timeOffBlocks, { ...partial, id: newId("pto") }],
        })),

      removeTimeOffBlock: (id) =>
        set((s) => ({
          timeOffBlocks: s.timeOffBlocks.filter((b) => b.id !== id),
        })),

      setWorkers: (workers) => set({ workers }),
      setZones: (zones) => set({ zones }),
      setRoles: (roles) => set({ roles }),
      setShiftTypes: (shiftTypes) => set({ shiftTypes }),
      setPendingRequests: (pendingRequests) => set({ pendingRequests }),
      setSettings: (patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            ...patch,
            staffing: patch.staffing
              ? { ...s.settings.staffing, ...patch.staffing }
              : s.settings.staffing,
          },
        })),

      resetDemo: () => set(initialState()),

      applyPulseScheduleSnapshot: (workers, zones, newShifts) =>
        set({
          workers,
          zones,
          shifts: newShifts,
        }),
    }),
    {
      name: "pulse_schedule_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        workers: s.workers,
        shifts: s.shifts,
        zones: s.zones,
        roles: s.roles,
        shiftTypes: s.shiftTypes,
        settings: s.settings,
        pendingRequests: s.pendingRequests,
        timeOffBlocks: s.timeOffBlocks,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<ScheduleState> | undefined;
        if (!p) return current;
        const mergedShifts = (p.shifts ?? current.shifts).map((s) => ({
          ...s,
          eventType: (s as Shift).eventType ?? ("work" as ShiftEventType),
        }));
        return {
          ...current,
          ...p,
          shifts: mergedShifts,
          timeOffBlocks: p.timeOffBlocks ?? current.timeOffBlocks,
          workers: p.workers ?? current.workers,
        };
      },
    },
  ),
);
