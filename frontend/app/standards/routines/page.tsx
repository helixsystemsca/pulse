"use client";

import { ListTodo } from "lucide-react";
import Link from "next/link";
import { RoutinesApp } from "@/components/routines/RoutinesApp";
import { PageHeader } from "@/components/ui/PageHeader";

export default function StandardsRoutinesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Routines"
        description="Reusable shift checklists and recurring task templates. Staff run them from the schedule; completed runs live in the archive."
        icon={ListTodo}
        actions={
          <Link
            href="/standards/routines/archive"
            className="inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-secondary px-3 py-2 text-sm font-semibold text-ds-foreground shadow-sm transition-colors hover:bg-ds-interactive-hover"
          >
            View archive
          </Link>
        }
      />
      <RoutinesApp />
    </div>
  );
}

