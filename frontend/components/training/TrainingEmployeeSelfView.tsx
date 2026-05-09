"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { TrainingMatrixTable } from "@/components/training/TrainingMatrixTable";
import { isApiMode } from "@/lib/api";
import { complianceAlertsForEmployee } from "@/lib/training/complianceAlerts";
import { MOCK_TRAINING_PROGRAMS } from "@/lib/training/mockData";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import {
  acknowledgementsFromWorkerTraining,
  fetchWorkerTraining,
  mapApiAssignments,
  mapApiPrograms,
  type WorkerTrainingApiResponse,
} from "@/lib/trainingApi";
import { trainingAcknowledgementsForPersona, trainingAssignmentsForPersona } from "@/lib/training/selectors";
import type { TrainingAcknowledgement, TrainingAssignment, TrainingEmployee, TrainingProgram } from "@/lib/training/types";

const TIER_SORT: TrainingProgram["tier"][] = ["mandatory", "high_risk", "general"];

export function TrainingEmployeeSelfView() {
  const api = isApiMode();
  const session = readSession();
  const workerId = session?.sub ?? "";
  const displayName = (session?.full_name ?? session?.email ?? "Your profile").trim();

  const [bundle, setBundle] = useState<WorkerTrainingApiResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !workerId) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    void (async () => {
      try {
        const data = await fetchWorkerTraining(workerId);
        if (!cancelled) setBundle(data);
      } catch (e) {
        if (!cancelled) setLoadErr(parseClientApiError(e).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, workerId]);

  const useLive = Boolean(api && bundle && !loadErr);

  const programs = useMemo(() => {
    const raw = useLive ? mapApiPrograms(bundle!.programs).filter((p) => p.active) : MOCK_TRAINING_PROGRAMS.filter((p) => p.active);
    return [...raw].sort((a, b) => {
      const ti = TIER_SORT.indexOf(a.tier);
      const tj = TIER_SORT.indexOf(b.tier);
      if (ti !== tj) return ti - tj;
      return a.title.localeCompare(b.title);
    });
  }, [useLive, bundle]);

  const assignments: TrainingAssignment[] = useLive
    ? mapApiAssignments(bundle!.assignments)
    : trainingAssignmentsForPersona(workerId || "demo-worker");

  const acks: TrainingAcknowledgement[] = useLive
    ? acknowledgementsFromWorkerTraining(workerId, bundle!)
    : trainingAcknowledgementsForPersona(workerId || "demo-worker");

  const trustServer = useLive;

  const meRow: TrainingEmployee = useMemo(
    () => ({
      id: workerId,
      display_name: displayName,
      department: session?.job_title?.trim() || "—",
    }),
    [workerId, displayName, session?.job_title],
  );

  const alerts = useMemo(
    () =>
      workerId
        ? complianceAlertsForEmployee(workerId, programs, assignments, acks, trustServer)
        : [],
    [workerId, programs, assignments, acks, trustServer],
  );

  if (!workerId) {
    return (
      <div className="rounded-xl border border-ds-border bg-ds-primary/80 p-5 text-sm text-ds-muted">
        Sign in to view your training assignments and acknowledgements.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-ds-border bg-ds-primary/80 p-4 shadow-[var(--ds-shadow-card)] sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] text-[var(--ds-accent)]">
            <ClipboardCheck className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ds-foreground">My training record</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ds-muted">
              Your assigned procedures, completions, and acknowledgements — same matrix layout as the team board, scoped to
              you. Leads, supervisors, managers, and tenant admins see everyone&apos;s rows on this page.
            </p>
            <p className="mt-2 text-xs font-medium text-ds-foreground">{displayName}</p>
            {loading ? <p className="mt-2 text-xs text-ds-muted">Loading…</p> : null}
            {loadErr ? (
              <p className="mt-2 text-xs font-semibold text-ds-danger" role="alert">
                Could not load training: {loadErr}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {alerts.length > 0 ? (
        <section className="rounded-xl border border-ds-border bg-ds-secondary/40 p-4">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Compliance attention</h3>
          <ol className="mt-3 space-y-2 text-sm">
            {alerts.map((a) => (
              <li
                key={a.programId}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ds-border/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="font-medium text-ds-foreground">{a.title}</span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    a.priority <= 2 ? "text-ds-danger" : a.priority === 3 ? "text-ds-warning" : "text-ds-muted"
                  }`}
                >
                  {a.label}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="space-y-2">
        <div>
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Your training matrix</h3>
          <p className="mt-1 text-xs text-ds-muted">
            One row (you) × procedures. Teal = complete · Yellow = expiring soon · Pink = mandatory gap · Peach = optional /
            general gap.
          </p>
        </div>
        <TrainingMatrixTable
          employees={[meRow]}
          programs={programs}
          assignments={assignments}
          acknowledgements={acks}
          trustAssignmentStatus={trustServer}
          statusColumnFilter="all"
        />
      </section>

      <section className="rounded-xl border border-ds-border bg-ds-secondary/30 p-4">
        <h3 className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Acknowledgement history</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {acks.length === 0 ? (
            <li className="text-ds-muted">No acknowledgement records on file.</li>
          ) : (
            acks.map((k) => {
              const p = programs.find((x) => x.id === k.training_program_id);
              return (
                <li key={k.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ds-border/60 pb-2">
                  <span className="font-medium text-ds-foreground">{p?.title ?? k.training_program_id}</span>
                  <span className="text-xs tabular-nums text-ds-muted">
                    Rev {k.revision_number} · {k.acknowledged_at.slice(0, 10)}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </section>
    </div>
  );
}
