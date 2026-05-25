"use client";

import { useMemo, useState } from "react";
import { Search, Upload } from "lucide-react";
import { cn } from "@/lib/cn";
import { useWorkforceQualifications } from "@/components/standards/workforce-training/WorkforceQualificationsContext";
import { QualificationStatusChip } from "@/components/standards/workforce-training/QualificationStatusChip";
import { WorkerTrainingMatrixPanel } from "@/components/training/WorkerTrainingMatrixPanel";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { Button } from "@/components/ui/Button";
import type { WorkerQualificationSummary } from "@/lib/standards/employee-certifications";

type StatusFilter = "all" | "gaps" | "current";

export function WorkersQualificationView() {
  const { api, loading, err, byWorker, workers } = useWorkforceQualifications();
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const w of workers) {
      if (w.department) set.add(w.department);
    }
    return [...set].sort();
  }, [workers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return byWorker.filter((w) => {
      if (department !== "all" && w.department !== department) return false;
      if (statusFilter === "gaps" && w.expiredCount === 0 && w.expiringCount === 0 && w.missingProofCount === 0) {
        return false;
      }
      if (statusFilter === "current" && (w.expiredCount > 0 || w.expiringCount > 0)) return false;
      if (!q) return true;
      return w.workerName.toLowerCase().includes(q) || (w.department ?? "").toLowerCase().includes(q);
    });
  }, [byWorker, search, department, statusFilter]);

  const selected: WorkerQualificationSummary | null =
    filtered.find((w) => w.workerId === selectedId) ?? filtered[0] ?? null;

  const selectedWorker = workers.find((w) => w.id === selected?.workerId);

  return (
    <div className="grid min-h-[32rem] gap-4 lg:grid-cols-[minmax(240px,300px)_1fr]">
      <aside className="flex flex-col rounded-xl border border-ds-border bg-ds-card">
        <div className="border-b border-ds-border p-3 space-y-3">
          <label className={dsLabelClass} htmlFor="wq-search">
            Search workers
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" aria-hidden />
            <input
              id="wq-search"
              className={cn(dsInputClass, "pl-9")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or department"
            />
          </div>
          <select className={dsInputClass} value={department} onChange={(e) => setDepartment(e.target.value)}>
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select className={dsInputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="gaps">Has gaps</option>
            <option value="current">Current only</option>
          </select>
        </div>
        <ul className="flex-1 overflow-y-auto p-2">
          {loading ? <li className="px-2 py-4 text-sm text-ds-muted">Loading…</li> : null}
          {err ? <li className="px-2 py-4 text-sm text-rose-600">{err}</li> : null}
          {!loading && filtered.length === 0 ? (
            <li className="px-2 py-8 text-center text-sm text-ds-muted">No workers match filters.</li>
          ) : null}
          {filtered.map((w) => {
            const active = selected?.workerId === w.workerId;
            return (
              <li key={w.workerId}>
                <button
                  type="button"
                  onClick={() => setSelectedId(w.workerId)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left text-sm transition",
                    active ? "bg-ds-primary text-white" : "hover:bg-ds-muted/30 text-ds-foreground",
                  )}
                >
                  <p className="font-semibold">{w.workerName}</p>
                  <p className={cn("text-xs", active ? "text-white/80" : "text-ds-muted")}>{w.department ?? "—"}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {w.expiredCount > 0 ? (
                      <span className={cn("rounded px-1.5 text-[10px] font-bold", active ? "bg-white/20" : "bg-rose-100 text-rose-800")}>
                        {w.expiredCount} expired
                      </span>
                    ) : null}
                    {w.expiringCount > 0 ? (
                      <span className={cn("rounded px-1.5 text-[10px] font-bold", active ? "bg-white/20" : "bg-amber-100 text-amber-900")}>
                        {w.expiringCount} expiring
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="space-y-4 rounded-xl border border-ds-border bg-ds-card p-4">
        {!selected ? (
          <p className="py-12 text-center text-sm text-ds-muted">
            {api ? "Select a worker to view qualifications." : "Enable API mode to load worker profiles."}
          </p>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ds-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-ds-foreground">{selected.workerName}</h3>
                <p className="text-sm text-ds-muted">
                  {selected.department ?? "No department"} · {selectedWorker?.job_title ?? selectedWorker?.role ?? "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" disabled title="Proof upload — coming soon">
                  <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Upload proof
                </Button>
                <Button type="button" variant="secondary" className="text-xs px-3 py-1.5" disabled title="Verification workflow — coming soon">
                  Verify
                </Button>
              </div>
            </header>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Certifications</h4>
              {selected.certifications.length === 0 ? (
                <p className="mt-2 text-sm text-ds-muted">No registry-matched certifications on file.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {selected.certifications.map((c) => (
                    <li
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-ds-border/70 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-mono text-xs text-ds-muted">{c.registryCode}</span>{" "}
                        <span className="font-medium text-ds-foreground">{c.label}</span>
                        <p className="text-xs text-ds-muted">
                          Expires {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString() : "—"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <QualificationStatusChip kind="competency" value={c.competencyState} />
                        <QualificationStatusChip kind="verification" value={c.verificationStatus} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h4 className="text-xs font-bold uppercase tracking-wide text-ds-muted">Procedure competencies</h4>
              <p className="mt-1 text-xs text-ds-muted">SOP sign-offs and quizzes — owned under Procedures.</p>
              <div className="mt-2">
                <WorkerTrainingMatrixPanel employeeId={selected.workerId} employeeName={selected.workerName} />
              </div>
            </section>

            <section className="rounded-lg border border-dashed border-ds-border bg-ds-muted/10 p-3 text-sm">
              <h4 className="font-semibold text-ds-foreground">Operational coverage</h4>
              <p className="mt-1 text-ds-muted">
                Qualified roles and staffing eligibility will map registry codes to schedule requirements. Foundation for
                scheduler and project validation.
              </p>
              <ul className="mt-2 space-y-1 text-xs text-ds-muted">
                <li>Qualified: {selected.qualifiedCount} certification(s)</li>
                <li>Missing proof: {selected.missingProofCount}</li>
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
