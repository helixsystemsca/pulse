"use client";

import { RoutinesApp } from "@/components/routines/RoutinesApp";
import Link from "next/link";

export default function StandardsRoutinesPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/standards/routines/archive"
          className="inline-flex items-center gap-2 rounded-md border border-ds-border bg-ds-secondary px-3 py-2 text-sm font-semibold text-ds-foreground hover:bg-ds-interactive-hover"
        >
          View archive
        </Link>
      </div>
      <RoutinesApp />
    </div>
  );
}

