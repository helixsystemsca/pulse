"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { useEmployeeProfile } from "@/lib/team-management/employee-profile/hooks/useEmployeeProfile";

export type EmployeeProfileContextValue = ReturnType<typeof useEmployeeProfile>;

const Ctx = createContext<EmployeeProfileContextValue | null>(null);

export function EmployeeProfileProvider({
  value,
  children,
}: {
  value: EmployeeProfileContextValue;
  children: ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmployeeProfileContext(): EmployeeProfileContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEmployeeProfileContext requires EmployeeProfileProvider");
  return ctx;
}
