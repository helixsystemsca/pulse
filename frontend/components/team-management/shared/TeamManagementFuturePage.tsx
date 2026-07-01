"use client";

import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import type { LucideIcon } from "lucide-react";
import { Construction } from "lucide-react";

export function TeamManagementFuturePage({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} icon={Icon} />
      <PageBody>
        <div className="ops-dash-inner-card max-w-xl p-6">
          <p className="text-sm text-ds-muted">
            This area is structured for future expansion. Employee data will continue to come from the
            shared Team Roster — no duplicate records.
          </p>
        </div>
      </PageBody>
    </div>
  );
}
