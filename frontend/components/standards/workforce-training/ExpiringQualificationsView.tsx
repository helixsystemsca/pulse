"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkforceQualifications } from "@/components/standards/workforce-training/WorkforceQualificationsContext";
import { QualificationStatusChip } from "@/components/standards/workforce-training/QualificationStatusChip";
import type { EmployeeCertificationRecord } from "@/lib/standards/employee-certifications";
import { cn } from "@/lib/cn";

type QueueTab = "expiring" | "expired" | "missing_proof" | "pending_verification";

function severityFor(row: EmployeeCertificationRecord, tab: QueueTab): "warning" | "critical" | "expired" {
  if (tab === "expired" || row.competencyState === "expired") return "expired";
  if (tab === "missing_proof") return "warning";
  if (tab === "pending_verification") return "warning";
  return "warning";
}

export function ExpiringQualificationsView() {
  const { loading, err, expiring, expired, missingProof, pendingVerification } = useWorkforceQualifications();
  const [tab, setTab] = useState<QueueTab>("expiring");

  const rows = useMemo(() => {
    if (tab === "expired") return expired;
    if (tab === "missing_proof") return missingProof;
    if (tab === "pending_verification") return pendingVerification;
    return expiring;
  }, [tab, expiring, expired, missingProof, pendingVerification]);

  const tabs: { id: QueueTab; label: string; count: number }[] = [
    { id: "expiring", label: "Expiring soon", count: expiring.length },
    { id: "expired", label: "Expired", count: expired.length },
    { id: "missing_proof", label: "Missing proof", count: missingProof.length },
    { id: "pending_verification", label: "Pending verification", count: pendingVerification.length },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-ds-muted">
        Operational queue for leadership and audits. Approvals are not blocked here — use worker profiles for follow-up.
      </p>

      <nav className="flex flex-wrap gap-1" aria-label="Expiring queues">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-semibold transition",
              tab === t.id ? "bg-ds-primary text-white" : "text-ds-muted hover:bg-ds-muted/30",
            )}
          >
            {t.label}
            <span className="ml-1.5 tabular-nums opacity-80">({t.count})</span>
          </button>
        ))}
      </nav>

      {loading ? <p className="text-sm text-ds-muted">Loading queue…</p> : null}
      {err ? <p className="text-sm text-rose-600">{err}</p> : null}

      <div className="ds-premium-panel overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-ds-border text-left text-xs font-bold uppercase tracking-wide text-ds-muted">
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Worker</th>
              <th className="px-3 py-2">Certification</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Expiry</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-ds-muted">
                  No items in this queue.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-ds-border/60">
                  <td className="px-3 py-2">
                    <QualificationStatusChip kind="severity" value={severityFor(r, tab)} />
                  </td>
                  <td className="px-3 py-2 font-medium text-ds-foreground">{r.workerName}</td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-xs text-ds-muted">{r.registryCode}</span> {r.label}
                  </td>
                  <td className="px-3 py-2 text-ds-muted">{r.department ?? "—"}</td>
                  <td className="px-3 py-2 text-ds-muted">
                    {r.expiryDate ? new Date(r.expiryDate).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <QualificationStatusChip kind="competency" value={r.competencyState} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/standards/training/workers`}
                      className="text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
                    >
                      Open worker
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
