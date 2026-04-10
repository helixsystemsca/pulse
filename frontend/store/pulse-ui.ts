import { create } from "zustand";

export type WorkRequestStatusFilter = "open" | "in_progress" | "complete" | "cancelled" | null;

type PulseUIState = {
  workRequestStatusFilter: WorkRequestStatusFilter;
  workRequestSearch: string;
  setWorkRequestStatusFilter: (v: WorkRequestStatusFilter) => void;
  setWorkRequestSearch: (v: string) => void;
};

export const usePulseUIStore = create<PulseUIState>((set) => ({
  workRequestStatusFilter: null,
  workRequestSearch: "",
  setWorkRequestStatusFilter: (v) => set({ workRequestStatusFilter: v }),
  setWorkRequestSearch: (v) => set({ workRequestSearch: v }),
}));
