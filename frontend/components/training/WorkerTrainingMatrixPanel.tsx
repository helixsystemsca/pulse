"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MOCK_TRAINING_PROGRAMS, effectiveAssignmentStatus } from "@/lib/training/mockData";
import { assignmentFor, trainingAcknowledgementsForPersona, trainingAssignmentsForPersona } from "@/lib/training/selectors";
import type { TrainingAcknowledgement, TrainingAssignment, TrainingProgram } from "@/lib/training/types";
import { TrainingStatusBadge } from "@/components/training/TrainingStatusBadge";
import { TrainingTierBadge } from "@/components/training/TrainingTierBadge";
import { cn } from "@/lib/cn";
import { isApiMode } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import {
  acknowledgementsFromWorkerTraining,
  fetchWorkerTraining,
  mapApiAssignments,
  mapApiPrograms,
  type WorkerTrainingApiResponse,
} from "@/lib/trainingApi";

const TIER_ORDER: TrainingProgram["tier"][] = ["mandatory", "high_risk", "general"];

const TIER_HEADING: Record<TrainingProgram["tier"], string> = {
  mandatory: "Routines",
  high_risk: "High risk",
  general: "General",
};

export function WorkerTrainingMatrixPanel({
  employeeId,
  employeeName,
}: {
  employeeId: string;
  employeeName: string;
}) {
  const api = isApiMode();
  const [bundle, setBundle] = useState<WorkerTrainingApiResponse | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api || !employeeId) {
      setBundle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadErr(null);
    void (async () => {
      try {
        const data = await fetchWorkerTraining(employeeId);
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
  }, [api, employeeId]);

  const useLive = Boolean(api && bundle && !loadErr);

  const programs = useLive ? mapApiPrograms(bundle!.programs).filter((p) => p.active) : MOCK_TRAINING_PROGRAMS.filter((p) => p.active);
  const assignments: TrainingAssignment[] = useLive
    ? mapApiAssignments(bundle!.assignments)
    : trainingAssignmentsForPersona(employeeId);
  const acks: TrainingAcknowledgement[] = useLive
    ? acknowledgementsFromWorkerTraining(employeeId, bundle!)
    : trainingAcknowledgementsForPersona(employeeId);

  const overdue = assignments.filter((a) => {
    const p = programs.find((x) => x.id === a.training_program_id);
    if (!p || !a.due_date) return false;
    const eff = effectiveAssignmentStatus(p, a, acks);
    return eff === "pending" && new Date(a.due_date) < new Date();
  });

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-ds-border bg-ds-secondary/40 px-3 py-3 text-sm">
        <p className="font-semibold text-ds-foreground">{employeeName}</p>
        <p className="mt-1 text-xs leading-relaxed text-ds-muted">
          {useLive
            ? "Training assignments and acknowledgements from your organization backend."
            : "Demo training snapshot mapped deterministically to this profile for UI testing."}
        </p>
        {loading ? <p className="mt-2 text-xs text-ds-muted">Loading training…</p> : null}
        {loadErr ? <p className="mt-2 text-xs font-semibold text-ds-danger">Could not load training: {loadErr}</p> : null}
        <p className="mt-2">
          <Link href="/standards/training" className="ds-link text-xs font-semibold">
            Open Standards → Training →
          </Link>
        </p>
      </div>

      {overdue.length > 0 ? (
        <div className="rounded-lg border border-ds-danger/25 bg-[color-mix(in_srgb,var(--ds-danger)_8%,transparent)] px-3 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ds-danger">Overdue</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-ds-foreground">
            {overdue.map((a) => {
              const p = programs.find((x) => x.id === a.training_program_id);
              return (
                <li key={a.id}>
                  {p?.title ?? a.training_program_id}
                  {a.due_date ? <span className="text-ds-muted"> — due {a.due_date}</span> : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {TIER_ORDER.map((tier) => {
        const tierPrograms = programs.filter((p) => p.tier === tier);
        if (!tierPrograms.length) return null;
        return (
          <section key={tier}>
            <div className="flex items-center gap-2">
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">{TIER_HEADING[tier]}</h4>
              <TrainingTierBadge tier={tier} />
            </div>
            <ul className="mt-3 space-y-3">
              {tierPrograms.map((p) => (
                <ProgramRow key={p.id} program={p} employeeId={employeeId} assignments={assignments} acks={acks} trustServer={useLive} />
              ))}
            </ul>
          </section>
        );
      })}

      <section>
        <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-ds-muted">Acknowledgement history</h4>
        <ul className="mt-2 space-y-2 text-sm">
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

function ProgramRow({
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
  const eff =
    trustServer && a && a.status !== "not_assigned" ? a.status : effectiveAssignmentStatus(program, a, acks);
  return (
    <li className={cn("rounded-lg border border-ds-border bg-ds-primary px-3 py-3")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ds-foreground">{program.title}</p>
          <p className="mt-0.5 text-xs text-ds-muted">{program.description}</p>
        </div>
        <TrainingStatusBadge status={eff} />
      </div>
      <dl className="mt-2 grid gap-1 text-[11px] text-ds-muted sm:grid-cols-2">
        <div>
          <dt className="inline font-semibold text-ds-muted">Assigned: </dt>
          <dd className="inline tabular-nums">{a?.assigned_date ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-ds-muted">Due: </dt>
          <dd className="inline tabular-nums">{a?.due_date ?? "—"}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-ds-muted">Completed: </dt>
          <dd className="inline tabular-nums">{a?.completed_date ? String(a.completed_date).slice(0, 10) : "—"}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-ds-muted">Expires: </dt>
          <dd className="inline tabular-nums">{a?.expiry_date ?? "—"}</dd>
        </div>
        {program.requires_acknowledgement ? (
          <div className="sm:col-span-2">
            <dt className="inline font-semibold text-ds-muted">Acknowledgement: </dt>
            <dd className="inline tabular-nums">{a?.acknowledgement_date?.slice(0, 10) ?? "—"}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-semibold text-ds-muted">Supervisor sign-off: </dt>
          <dd className="inline">{a?.supervisor_signoff ? "Yes" : "—"}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-ds-muted">Procedure revision: </dt>
          <dd className="inline tabular-nums">
            r{program.revision_number} ({program.revision_date})
          </dd>
        </div>
      </dl>
    </li>
  );
}
