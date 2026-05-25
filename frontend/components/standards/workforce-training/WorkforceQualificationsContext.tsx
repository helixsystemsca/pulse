"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useWorkforceQualificationsState,
  type WorkforceQualificationsState,
} from "@/components/standards/workforce-training/useWorkforceQualifications";

const WorkforceQualificationsContext = createContext<WorkforceQualificationsState | null>(null);

export function WorkforceQualificationsProvider({ children }: { children: ReactNode }) {
  const value = useWorkforceQualificationsState();
  return (
    <WorkforceQualificationsContext.Provider value={value}>{children}</WorkforceQualificationsContext.Provider>
  );
}

export function useWorkforceQualifications(): WorkforceQualificationsState {
  const ctx = useContext(WorkforceQualificationsContext);
  if (!ctx) {
    throw new Error("useWorkforceQualifications must be used within WorkforceQualificationsProvider");
  }
  return ctx;
}
