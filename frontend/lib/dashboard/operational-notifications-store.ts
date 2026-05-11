"use client";

import { create } from "zustand";
import type { OperationalNotificationItem } from "@/lib/dashboard/operational-notifications";

type OperationalNotificationsState = {
  items: OperationalNotificationItem[];
  setItems: (items: OperationalNotificationItem[]) => void;
  clear: () => void;
};

export const useOperationalNotificationsStore = create<OperationalNotificationsState>((set) => ({
  items: [],
  setItems: (items) => set({ items }),
  clear: () => set({ items: [] }),
}));
