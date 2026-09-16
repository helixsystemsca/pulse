"use client";

import type { ReactNode } from "react";
import { PlanningHubChrome } from "@/components/planning/PlanningHubChrome";

export function PlanningHubLayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-4">
      <PlanningHubChrome />
      {children}
    </div>
  );
}
