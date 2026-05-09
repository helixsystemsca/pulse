"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { TrainingStatusBadge } from "@/components/training/TrainingStatusBadge";
import { TrainingTierBadge } from "@/components/training/TrainingTierBadge";
import { isApiMode } from "@/lib/api";
import { complianceAlertsForEmployee } from "@/lib/training/complianceAlerts";
import { MOCK_TRAINING_PROGRAMS, cellAssignmentStatus } from "@/lib/training/mockData";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";
import {
  acknowledgementsFromWorkerTraining,
  fetchWorkerTraining,
  mapApiAssignments,
  mapApiPrograms,
  type WorkerTrainingApiResponse,
} from "@/lib/trainingApi";
import {
  assignmentFor,
  trainingAcknowledgementsForPersona,
  trainingAssignmentsForPersona,
} from "@/lib/training/selectors";
import type { TrainingAcknowledgement, TrainingAssignment, TrainingProgram } from "@/lib/training/types";

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
              Your assigned procedures, completions, and acknowledgements. Team-wide compliance visibility is limited to
              supervisors and managers.
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

      <section className="overflow-hidden rounded-xl border border-ds-border bg-ds-primary shadow-[var(--ds-shadow-card)]">
        <div className="border-b border-ds-border bg-ds-secondary/50 px-4 py-3">
          <h3 className="text-[11px] font-bold uppercase tracking-wide text-ds-muted">Assignments & status</h3>
          <p className="mt-1 text-xs text-ds-muted">Dense grid for quick scanning — same signals supervisors see per person.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ds-border bg-ds-secondary/30 text-[11px] font-bold uppercase tracking-wide text-ds-muted">
                <th className="whitespace-nowrap px-3 py-2">Procedure</th>
                <th className="whitespace-nowrap px-3 py-2">Tier</th>
                <th className="whitespace-nowrap px-3 py-2">Status</th>
                <th className="whitespace-nowrap px-3 py-2">Due</th>
                <th className="whitespace-nowrap px-3 py-2">Expires</th>
                <th className="whitespace-nowrap px-3 py-2">Ack</th>
              </tr>
            </thead>
            <tbody>
              {programs.map((p) => (
                <SelfRow key={p.id} program={p} employeeId={workerId} assignments={assignments} acks={acks} trustServer={trustServer} />
              ))}
            </tbody>
          </table>
        </div>
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

function SelfRow({
  program,
  employeeId,
  assignments,
  acks,
  trustServer,
}: {
  program: TrainingProgram;
  employeeId: string;
  assignments: TrainingAssignment[];
  acks: TrainingAcknowledgement[];
  trustServer: boolean;
}) {
  const a = assignmentFor(employeeId, program.id, assignments);
  const eff = cellAssignmentStatus(program, a, acks, { trustAssignmentStatus: trustServer });
  return (
    <tr className="border-b border-ds-border/70 hover:bg-ds-interactive-hover/40">
      <td className="max-w-[280px] px-3 py-2 align-top">
        <div className="font-medium leading-snug text-ds-foreground">{program.title}</div>
        {program.description ? <div className="mt-0.5 line-clamp-2 text-xs text-ds-muted">{program.description}</div> : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <TrainingTierBadge tier={program.tier} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <TrainingStatusBadge status={eff} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums text-ds-muted">{a?.due_date ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums text-ds-muted">{a?.expiry_date ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-2 align-top tabular-nums text-ds-muted">
        {a?.acknowledgement_date ? a.acknowledgement_date.slice(0, 10) : "—"}
      </td>
    </tr>
  );
}
