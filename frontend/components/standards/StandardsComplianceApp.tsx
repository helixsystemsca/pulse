"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TrainingComplianceDashboard } from "@/components/training/TrainingComplianceDashboard";
import { ProcedureAcknowledgmentsArchiveClient } from "@/components/standards/ProcedureAcknowledgmentsArchiveClient";
import { cn } from "@/lib/cn";

type ComplianceTab = "dashboard" | "archive";

export function StandardsComplianceApp() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ComplianceTab>("dashboard");

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "archive") setTab("archive");
    else if (typeof window !== "undefined" && window.location.hash.toLowerCase().includes("matrix")) {
      setTab("dashboard");
    }
  }, [searchParams]);

  return (
    <div className="space-y-6">
      <nav className="flex gap-1 border-b border-ds-border pb-2" aria-label="Compliance sections">
        {(
          [
            { id: "dashboard" as const, label: "Readiness dashboard" },
            { id: "archive" as const, label: "Acknowledgment archive" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition",
              tab === t.id
                ? "bg-ds-primary text-white"
                : "text-ds-muted hover:bg-ds-muted/30 hover:text-ds-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
        <Link
          href="/standards/training"
          className="ml-auto self-center text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
        >
          Assigned learning →
        </Link>
      </nav>

      {tab === "dashboard" ? <TrainingComplianceDashboard /> : <ProcedureAcknowledgmentsArchiveClient />}
    </div>
  );
}
