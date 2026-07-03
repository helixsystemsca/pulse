"use client";

import { Suspense } from "react";
import { RoadmapApp } from "@/components/roadmap/RoadmapApp";

export default function RoadmapPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-ds-muted">Loading roadmap…</p>
        </div>
      }
    >
      <div className="p-4 lg:p-6">
        <RoadmapApp />
      </div>
    </Suspense>
  );
}
