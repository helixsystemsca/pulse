"use client";

import { create } from "zustand";
import type { OperationalNotificationItem } from "@/lib/dashboard/operational-notifications";

type OperationalNotificationsState = {
  items: OperationalNotificationItem[];
  setItems: (items: OperationalNotificationItem[]) => void;
  dismissItem: (id: string) => void;
  clear: () => void;
};

export const useOperationalNotificationsStore = create<OperationalNotificationsState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  dismissItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
  clear: () => set({ items: [] }),
}));
