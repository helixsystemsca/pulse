"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchWorkerTraining } from "@/lib/trainingApi";
import { readSession } from "@/lib/pulse-session";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { cellAssignmentStatus } from "@/lib/training/mockData";
import { assignmentFor } from "@/lib/training/selectors";
import type { TrainingAcknowledgement } from "@/lib/training/types";
import { cn } from "@/lib/cn";

export default function MyProceduresCompliancePage() {
  const session = readSession();
  const userId = session?.sub ?? "";
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof fetchWorkerTraining>> | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const b = await fetchWorkerTraining(userId);
        if (!cancelled) setBundle(b);
      } catch (e) {
        if (!cancelled) setErr(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!userId) {
    return <p className="text-sm text-ds-muted">Sign in to view your procedure assignments and acknowledgment status.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ds-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading your procedures…
      </div>
    );
  }

  if (err) {
    return (
      <p className="text-sm font-medium text-rose-600 dark:text-rose-400" role="alert">
        {err}
      </p>
    );
  }

  const programs = (bundle?.programs ?? []).filter((p) => p.active);
  const assignments = bundle?.assignments ?? [];
  const acks: TrainingAcknowledgement[] = (bundle?.acknowledgement_summary ?? []).map((row, i) => ({
    id: `ack-${userId}-${row.procedure_id}-${i}`,
    employee_id: userId,
    training_program_id: row.procedure_id,
    revision_number: row.revision_number,
    acknowledged_at: row.acknowledged_at,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-ds-foreground">My procedures</h1>
        <p className="mt-1 max-w-2xl text-sm text-ds-muted">
          Assigned training procedures and effective acknowledgment status (includes revision rules from the training engine).
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border border-ds-border/90 bg-ds-primary shadow-sm dark:border-ds-border dark:bg-ds-secondary/30">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ds-border/80 bg-ds-secondary/40 text-[11px] font-bold uppercase tracking-wide text-ds-muted dark:border-ds-border">
              <th className="px-3 py-2">Procedure</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Revision</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => {
              const a = assignmentFor(userId, p.id, assignments);
              const eff = cellAssignmentStatus(p, a, acks, { trustAssignmentStatus: true });
              return (
                <tr key={p.id} className="border-b border-ds-border/60 dark:border-ds-border/60">
                  <td className="px-3 py-2 font-medium text-ds-foreground">{p.title}</td>
                  <td className="px-3 py-2 text-ds-muted">{p.tier}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize",
                        eff === "completed" || eff === "expiring_soon"
                          ? "border-emerald-500/35 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100"
                          : eff === "not_applicable"
                            ? "border-slate-500/35 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                            : "border-amber-500/35 bg-amber-50 text-amber-950 dark:bg-amber-950/35 dark:text-amber-50",
                      )}
                    >
                      {eff.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-ds-muted">{p.revision_number}</td>
                  <td className="px-3 py-2">
                    <Link href="/standards/procedures" className="text-sm font-semibold text-teal-700 hover:underline dark:text-teal-300">
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
