"use client";

import type { ReactNode } from "react";

import { TeamManagementSectionNav } from "@/components/team-management/TeamManagementSectionNav";

export function TeamManagementLayoutClient({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <TeamManagementSectionNav />
      {children}
    </div>
  );
}
