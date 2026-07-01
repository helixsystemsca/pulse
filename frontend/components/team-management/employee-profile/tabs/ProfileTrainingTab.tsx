"use client";

import { useEmployeeProfileContext } from "@/components/team-management/employee-profile/EmployeeProfileContext";
import { formatShortDate } from "@/lib/team-management/development-types";

export function ProfileTrainingTab() {
  const { profile } = useEmployeeProfileContext();
  if (!profile) return null;
  const { training, worker } = profile;

  const assignments = training?.assignments ?? [];
  const programTitle = (programId: string) =>
    training?.programs.find((p) => p.id === programId)?.title ?? "Training item";
  const programTier = (programId: string) =>
    training?.programs.find((p) => p.id === programId)?.tier;
  const completed = assignments.filter((a) => a.status === "completed");
  const required = assignments.filter((a) => {
    const tier = programTier(a.training_program_id);
    return tier === "mandatory" || tier === "high_risk";
  });
  const pending = assignments.filter((a) => a.status !== "completed" && a.status !== "not_applicable");
  const certs = worker?.certifications ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="ops-dash-inner-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{completed.length}</p>
          <p className="text-[10px] font-bold uppercase text-ds-muted">Completed</p>
        </div>
        <div className="ops-dash-inner-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{required.length}</p>
          <p className="text-[10px] font-bold uppercase text-ds-muted">Required</p>
        </div>
        <div className="ops-dash-inner-card p-3 text-center">
          <p className="text-2xl font-bold tabular-nums">{pending.length}</p>
          <p className="text-[10px] font-bold uppercase text-ds-muted">Recommended</p>
        </div>
      </div>

      <section>
        <h3 className="text-xs font-bold uppercase text-ds-muted">Completed Courses</h3>
        <ul className="mt-2 space-y-2">
          {completed.length === 0 ? (
            <li className="text-sm text-ds-muted">No completed training on record.</li>
          ) : (
            completed.slice(0, 12).map((a) => (
              <li key={a.id} className="flex justify-between gap-2 rounded-lg border border-ds-border/50 px-3 py-2 text-sm">
                <span>{programTitle(a.training_program_id)}</span>
                <span className="text-xs text-ds-muted">{a.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase text-ds-muted">Required / Pending</h3>
        <ul className="mt-2 space-y-2">
          {pending.length === 0 ? (
            <li className="text-sm text-ds-muted">All required training current.</li>
          ) : (
            pending.slice(0, 12).map((a) => (
              <li key={a.id} className="flex justify-between gap-2 rounded-lg border border-ds-border/50 px-3 py-2 text-sm">
                <span>{programTitle(a.training_program_id)}</span>
                <span className="text-xs text-ds-muted">{a.status}</span>
              </li>
            ))
          )}
        </ul>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase text-ds-muted">Certifications</h3>
        <ul className="mt-2 space-y-2">
          {certs.length === 0 ? (
            <li className="text-sm text-ds-muted">No certifications on file.</li>
          ) : (
            certs.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 rounded-lg border border-ds-border/50 px-3 py-2 text-sm">
                <span>{c.name}</span>
                <span className="text-xs text-ds-muted">
                  {c.expiry_date ? `Expires ${formatShortDate(c.expiry_date)}` : c.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
