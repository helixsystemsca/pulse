"use client";

import Link from "next/link";
import { useEffect } from "react";
import { TrainingComplianceDashboard } from "@/components/training/TrainingComplianceDashboard";

/** Procedure training compliance matrix — reuses existing dashboard; matrix-first landing. */
export function WorkforceComplianceView() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.location.hash.includes("matrix")) {
      window.location.hash = "training-matrix";
    }
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ds-muted">
        Operational readiness from assigned procedure training. SOP sign-offs and quizzes remain under{" "}
        <Link href="/standards/procedures" className="font-semibold text-teal-700 hover:underline dark:text-teal-300">
          Procedures
        </Link>
        .{" "}
        <Link href="/standards/acknowledgments" className="font-semibold text-teal-700 hover:underline dark:text-teal-300">
          Acknowledgment archive
        </Link>
      </p>
      <TrainingComplianceDashboard />
    </div>
  );
}
