"use client";

import { ListChecks } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";

/** Standards section shell — primary navigation lives in the sidebar flyout. */
export function StandardsLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Standards"
        description="Procedures, workforce qualifications, certifications, and operational compliance readiness."
        icon={ListChecks}
      />
      <PageBody>{children}</PageBody>
    </div>
  );
}
