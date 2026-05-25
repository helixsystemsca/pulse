"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { fetchWorkerTraining } from "@/lib/trainingApi";
import { readSession } from "@/lib/pulse-session";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { myProcedureRowsForWorker } from "@/lib/training/selectors";
import { TRAINING_ROUTES } from "@/lib/training/routes";
import type { TrainingAcknowledgement } from "@/lib/training/types";
import { cn } from "@/lib/cn";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/StatusBadge";
import {
  uiSubsectionTitle,
  uiTableCell,
  uiTableHead,
  uiTableRow,
  uiTableWrap,
  uiTextLink,
} from "@/styles/ui-classes";

function assignmentStatusBadgeVariant(status: string): StatusBadgeVariant {
  if (status === "completed" || status === "expiring_soon" || status === "acknowledged") return "success";
  if (status === "not_applicable") return "neutral";
  if (status === "expired" || status === "quiz_failed") return "danger";
  return "warning";
}

/** Worker-facing assigned procedures — always scoped to the signed-in account (`session.sub`). */
export function MyProceduresAssignmentsView({ embedded = false }: { embedded?: boolean }) {
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

  const rows = useMemo(() => {
    if (!userId || !bundle) return [];
    const programs = (bundle.programs ?? []).filter((p) => p.active);
    const assignments = bundle.assignments ?? [];
    const acks: TrainingAcknowledgement[] = (bundle.acknowledgement_summary ?? []).map((row, i) => ({
      id: `ack-${userId}-${row.procedure_id}-${i}`,
      employee_id: userId,
      training_program_id: row.procedure_id,
      revision_number: row.revision_number,
      acknowledged_at: row.acknowledged_at,
    }));
    return myProcedureRowsForWorker(userId, programs, assignments, acks, { trustAssignmentStatus: true });
  }, [bundle, userId]);

  if (!userId) {
    return <p className="text-sm text-ds-muted">Sign in to view your assigned learning and acknowledgment status.</p>;
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ds-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        Loading your learning…
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

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded ? (
        <div>
          <h2 className={uiSubsectionTitle}>My Learning</h2>
          <p className="mt-1 max-w-2xl text-sm text-ds-muted">
            Assigned learning — procedures, acknowledgements, uploads, and completion status for your role.
          </p>
        </div>
      ) : null}
      <div className={uiTableWrap}>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ds-muted">No assigned learning right now.</p>
        ) : (
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <thead>
              <tr className={uiTableHead}>
                <th className={uiTableCell}>Procedure</th>
                <th className={uiTableCell}>Status</th>
                <th className={uiTableCell}>Revision</th>
                <th className={uiTableCell}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ program, status }) => (
                <tr key={program.id} className={uiTableRow}>
                  <td className={cn(uiTableCell, "font-medium")}>{program.title}</td>
                  <td className={uiTableCell}>
                    <StatusBadge variant={assignmentStatusBadgeVariant(status)}>
                      {status.replace(/_/g, " ")}
                    </StatusBadge>
                  </td>
                  <td className={cn(uiTableCell, "tabular-nums text-ds-muted")}>{program.revision_number}</td>
                  <td className={uiTableCell}>
                    <Link href={TRAINING_ROUTES.learningLibrary} className={cn("text-sm", uiTextLink)}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
