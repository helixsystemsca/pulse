"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, Settings } from "lucide-react";
import { dsInputClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import {
  MOCK_TRAINING_ACKNOWLEDGEMENTS,
  MOCK_TRAINING_EMPLOYEES,
  MOCK_TRAINING_PROGRAMS,
  MOCK_RESOLVED_ASSIGNMENTS,
} from "@/lib/training/mockData";
import type {
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingEmployee,
  TrainingProgram,
  TrainingTier,
} from "@/lib/training/types";
import {
  computeComplianceSummary,
  passesMatrixFilters,
  uniqueDepartments,
  type TrainingMatrixFilters,
} from "@/lib/training/selectors";
import { TrainingEmployeeSelfView } from "@/components/training/TrainingEmployeeSelfView";
import { TrainingMatrixTable } from "@/components/training/TrainingMatrixTable";
import { TrainingSummaryCards } from "@/components/training/TrainingSummaryCards";
import { isApiMode } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";
import { fetchWorkerList } from "@/lib/workersService";
import { fetchProcedures, type ProcedureRow } from "@/lib/cmmsApi";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { workersToTrainingEmployees, proceduresToTrainingPrograms } from "@/lib/training/liveCatalog";
import {
  readProcedureComplianceConfig,
  writeProcedureComplianceConfig,
  type ProcedureComplianceConfig,
  type ProcedureComplianceConfigMap,
} from "@/lib/training/procedureComplianceConfig";
import { generateDemoAssignmentsForMatrix } from "@/lib/training/generatedAssignments";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { trainingTeamMatrixAccess } from "@/lib/pulse-roles";
import { notifyLeadershipMandatoryOverdue } from "@/lib/training/notifications";
import { listProcedureSignoffs } from "@/lib/procedureSignoffs";
import {
  fetchTrainingMatrix,
  mapApiAssignments,
  mapApiEmployees,
  mapApiPrograms,
  patchProcedureCompliance,
  trainingProgramsToComplianceMap,
} from "@/lib/trainingApi";

const STATUS_OPTIONS: Array<{ value: TrainingAssignment["status"] | "all"; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "completed", label: "Completed" },
  { value: "expiring_soon", label: "Expiring soon" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending" },
  { value: "revision_pending", label: "Revision pending" },
  { value: "not_assigned", label: "Not assigned" },
];

const TIER_OPTIONS: Array<{ value: TrainingTier | "all"; label: string }> = [
  { value: "all", label: "All tiers" },
  { value: "mandatory", label: "Mandatory" },
  { value: "high_risk", label: "High risk" },
  { value: "general", label: "General" },
];

type MatrixBundle = {
  employees: TrainingEmployee[];
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
};

export function TrainingOverviewApp() {
  if (!trainingTeamMatrixAccess(readSession())) {
    return <TrainingEmployeeSelfView />;
  }
  return <TrainingLeadershipOverviewInner />;
}

function TrainingLeadershipOverviewInner() {
  const api = isApiMode();
  const [filters, setFilters] = useState<TrainingMatrixFilters>({
    department: "all",
    tier: "all",
    status: "all",
    search: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [matrixErr, setMatrixErr] = useState<string | null>(null);
  const [procedures, setProcedures] = useState<ProcedureRow[] | null>(null);
  const [employeesLive, setEmployeesLive] = useState<typeof MOCK_TRAINING_EMPLOYEES | null>(null);
  const [matrixBundle, setMatrixBundle] = useState<MatrixBundle | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [procConfig, setProcConfig] = useState<ProcedureComplianceConfigMap>({});
  const [configSaveErr, setConfigSaveErr] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    setMatrixErr(null);

    void (async () => {
      try {
        const session = readSession();
        const companyId = session?.company_id ?? null;
        const canMatrix = trainingTeamMatrixAccess(session);

        let loadedFromMatrix = false;
        if (canMatrix) {
          try {
            const m = await fetchTrainingMatrix();
            if (cancelled) return;
            const programsM = mapApiPrograms(m.programs);
            const employeesM = mapApiEmployees(m.employees);
            const assignmentsM = mapApiAssignments(m.assignments);
            setMatrixBundle({
              employees: employeesM,
              programs: programsM,
              assignments: assignmentsM,
            });
            setProcConfig(trainingProgramsToComplianceMap(programsM));
            setEmployeesLive(employeesM);
            setProcedures(null);
            loadedFromMatrix = true;
          } catch (me: unknown) {
            const status = (me as { status?: number }).status;
            if (status !== 403 && status !== 401) {
              setMatrixErr(parseClientApiError(me).message);
            }
            setMatrixBundle(null);
          }
        } else {
          setMatrixBundle(null);
        }

        if (!loadedFromMatrix) {
          try {
            setProcConfig(readProcedureComplianceConfig());
          } catch {
            setProcConfig({});
          }
          const [w, p] = await Promise.all([
            fetchWorkerList(companyId, { include_inactive: false }),
            fetchProcedures(),
          ]);
          if (cancelled) return;
          setEmployeesLive(workersToTrainingEmployees(w.items ?? []));
          setProcedures(p ?? []);
        }
      } catch (e) {
        if (!cancelled) setErr(parseClientApiError(e).message);
        if (!cancelled) {
          setEmployeesLive(null);
          setProcedures(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (!api) return;
    if (matrixBundle) return;
    const session = readSession();
    if (!trainingTeamMatrixAccess(session)) return;
    if (!employeesLive || !procedures || procedures.length === 0) return;

    const programsLive = proceduresToTrainingPrograms(procedures, procConfig);
    const { assignments } = generateDemoAssignmentsForMatrix(employeesLive, programsLive);
    const today = new Date();
    const seen = new Set<string>();
    for (const p of programsLive) {
      if (p.tier !== "mandatory") continue;
      if (!p.due_within_days) continue;
      for (const a of assignments) {
        if (a.training_program_id !== p.id) continue;
        if (a.status !== "pending") continue;
        if (!a.due_date) continue;
        if (new Date(a.due_date) >= today) continue;
        const key = `${a.employee_id}:${p.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        notifyLeadershipMandatoryOverdue({ employeeId: a.employee_id, programId: p.id });
      }
    }
  }, [api, matrixBundle, employeesLive, procedures, procConfig]);

  const employees = matrixBundle?.employees ?? employeesLive ?? MOCK_TRAINING_EMPLOYEES;

  const programs = useMemo(() => {
    if (matrixBundle) return matrixBundle.programs;
    if (procedures && procedures.length) {
      return proceduresToTrainingPrograms(procedures, procConfig);
    }
    return MOCK_TRAINING_PROGRAMS;
  }, [matrixBundle, procedures, procConfig]);

  const trustServerStatus = Boolean(matrixBundle);

  const generated = useMemo(() => {
    if (matrixBundle) {
      const acks: TrainingAcknowledgement[] = [];
      return { assignments: matrixBundle.assignments, acknowledgements: acks };
    }
    if (employeesLive && procedures && procedures.length) {
      const base = generateDemoAssignmentsForMatrix(employees, programs);

      const signoffByEmployee = new Map<string, Set<string>>();
      for (const e of employees) {
        const signed = new Set(listProcedureSignoffs(e.id).map((s) => s.procedure_id));
        if (signed.size) signoffByEmployee.set(e.id, signed);
      }

      const merged = base.assignments.map((a) => {
        const set = signoffByEmployee.get(a.employee_id);
        if (!set || !set.has(a.training_program_id)) return a;
        return {
          ...a,
          status: "completed" as const,
          completed_date: a.completed_date ?? new Date().toISOString().slice(0, 10),
        };
      });

      return { assignments: merged, acknowledgements: base.acknowledgements };
    }
    return { assignments: MOCK_RESOLVED_ASSIGNMENTS, acknowledgements: MOCK_TRAINING_ACKNOWLEDGEMENTS };
  }, [matrixBundle, employees, employeesLive, procedures, programs]);

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => passesMatrixFilters(e, filters));
  }, [filters, employees]);

  const matrixPrograms = useMemo(() => {
    if (filters.tier === "all") return programs;
    return programs.filter((p) => p.tier === filters.tier);
  }, [programs, filters.tier]);

  const summary = useMemo(
    () =>
      computeComplianceSummary(employees, programs, generated.assignments, generated.acknowledgements, {
        trustAssignmentStatus: trustServerStatus,
      }),
    [employees, programs, generated.assignments, generated.acknowledgements, trustServerStatus],
  );

  const departments = useMemo(() => ["all", ...uniqueDepartments(employees)], [employees]);

  const configRows = useMemo(() => {
    if (matrixBundle) return matrixBundle.programs.map((p) => ({ id: p.id, title: p.title }));
    if (procedures?.length) return procedures.map((p) => ({ id: p.id, title: p.title }));
    return [];
  }, [matrixBundle, procedures]);

  const persistProcedureConfig = useCallback(
    async (procedureId: string, next: ProcedureComplianceConfig) => {
      setConfigSaveErr(null);
      if (matrixBundle) {
        await patchProcedureCompliance(procedureId, {
          tier: next.tier,
          due_within_days: next.due_within_days,
          requires_acknowledgement: next.requires_acknowledgement,
        });
        setProcConfig((prev) => ({ ...prev, [procedureId]: next }));
        setMatrixBundle((b) => {
          if (!b) return b;
          const programsNext = b.programs.map((p) =>
            p.id === procedureId
              ? {
                  ...p,
                  tier: next.tier,
                  due_within_days: next.due_within_days ?? null,
                  requires_acknowledgement: next.requires_acknowledgement,
                }
              : p,
          );
          return { ...b, programs: programsNext };
        });
      } else {
        setProcConfig((prev) => {
          const merged = { ...prev, [procedureId]: next };
          writeProcedureComplianceConfig(merged);
          return merged;
        });
      }
    },
    [matrixBundle],
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-ds-border bg-ds-primary/80 p-4 shadow-[var(--ds-shadow-card)] sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] text-[var(--ds-accent)]">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ds-foreground">Maintenance training compliance board</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ds-muted">
              See which staff are missing training, have expired certifications, overdue onboarding, or unread procedures.
              Everything stays tracked and recorded for audits.
            </p>
            <p className="mt-2 text-xs font-medium text-ds-muted">
              View employee details in:{" "}
              <Link href="/dashboard/workers" className="ds-link font-semibold">
                Team Management
              </Link>{" "}
              → Profile → <span className="font-semibold text-ds-foreground">Training</span>.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setConfigOpen(true)}>
                <Settings className="h-4 w-4" aria-hidden />
                Configure procedure tiers
              </Button>
              {loading ? <span className="text-xs text-ds-muted">Loading live data…</span> : null}
              {!loading && err ? (
                <span className="text-xs font-semibold text-ds-danger">Live data unavailable: {err}</span>
              ) : null}
              {!loading && matrixErr ? (
                <span className="text-xs font-semibold text-ds-danger">Training matrix: {matrixErr}</span>
              ) : null}
              {!loading && api && !err && matrixBundle ? (
                <span className="text-xs text-ds-muted">Training matrix and tiers are loaded from the server.</span>
              ) : null}
              {!loading && api && !err && !matrixBundle ? (
                <span className="text-xs text-ds-muted">
                  Using roster + procedures; matrix uses demo statuses until the training API is available.
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <TrainingSummaryCards summary={summary} />

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Team compliance matrix</h3>
            <p className="mt-1 text-sm text-ds-muted">
              Rows = people · Columns = procedures (use training tier to show a subset) · Cells = assignment status
            </p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-ds-border bg-ds-secondary/40 p-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className={dsLabelClass} htmlFor="training-filter-search">
              Employee search
            </label>
            <input
              id="training-filter-search"
              className={dsInputClass}
              placeholder="Name or department"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="training-filter-dept">
              Department
            </label>
            <select
              id="training-filter-dept"
              className={dsSelectClass}
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "all" ? "All departments" : d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="training-filter-tier">
              Training tier
            </label>
            <select
              id="training-filter-tier"
              className={dsSelectClass}
              value={filters.tier}
              onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value as TrainingMatrixFilters["tier"] }))}
            >
              {TIER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="training-filter-status">
              Status
            </label>
            <select
              id="training-filter-status"
              className={dsSelectClass}
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as TrainingMatrixFilters["status"] }))}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <TrainingMatrixTable
          employees={filteredEmployees}
          programs={matrixPrograms}
          assignments={generated.assignments}
          acknowledgements={generated.acknowledgements}
          trustAssignmentStatus={trustServerStatus}
          statusColumnFilter={filters.status}
        />
      </section>

      <section className="rounded-xl border border-ds-border bg-ds-secondary/30 p-4 text-sm text-ds-muted">
        <p className="font-semibold text-ds-foreground">Notifications (stub)</p>
        <p className="mt-2 leading-relaxed">
          Expiry, overdue mandatory, new assignments, and revision acknowledgements emit through{" "}
          <code className="rounded bg-ds-primary px-1 py-0.5 font-mono text-xs">lib/training/notifications.ts</code> —
          wire to email / Teams / push when integrations land. Mandatory overdue events are also recorded server-side.
        </p>
      </section>

      <TierConfigModal
        open={configOpen}
        onClose={() => {
          setConfigOpen(false);
          setConfigSaveErr(null);
        }}
        rows={configRows}
        procConfig={procConfig}
        persistRow={persistProcedureConfig}
        saveError={configSaveErr}
        onSaveError={setConfigSaveErr}
        useServerPersistence={Boolean(matrixBundle)}
      />
    </div>
  );
}

function TierConfigModal({
  open,
  onClose,
  rows,
  procConfig,
  persistRow,
  saveError,
  onSaveError,
  useServerPersistence,
}: {
  open: boolean;
  onClose: () => void;
  rows: Array<{ id: string; title: string }>;
  procConfig: ProcedureComplianceConfigMap;
  persistRow: (procedureId: string, next: ProcedureComplianceConfig) => Promise<void>;
  saveError: string | null;
  onSaveError: (msg: string | null) => void;
  useServerPersistence: boolean;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-4">
      <div className="ds-modal-backdrop absolute inset-0" onClick={onClose} aria-hidden />
      <Card className="relative z-10 w-full max-w-3xl border border-ds-border shadow-[var(--ds-shadow-diffuse)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-ds-foreground">Procedure compliance configuration</p>
            <p className="mt-1 text-sm font-medium text-ds-muted">
              Set how each procedure counts for training (Mandatory / High risk / General).
              {useServerPersistence ? " Changes save to the server." : " Stored in this browser until the API is used."}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={onClose} className="h-9 px-3">
            Close
          </Button>
        </div>

        {saveError ? (
          <p className="mt-3 text-sm font-semibold text-ds-danger" role="alert">
            {saveError}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <div className="mt-4 rounded-lg border border-ds-border bg-ds-secondary/40 p-4 text-sm text-ds-muted">
            No procedures loaded yet. This list will populate when the Procedures library is available in API mode.
          </div>
        ) : (
          <div className="mt-4 max-h-[60vh] overflow-auto rounded-lg border border-ds-border">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-ds-secondary/40">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ds-muted">Procedure</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ds-muted">Tier</th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ds-muted">
                    Mandatory window (days)
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-ds-muted">
                    Requires acknowledgement
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const cfg = procConfig[p.id] ?? {
                    tier: "general" as const,
                    due_within_days: null,
                    requires_acknowledgement: true,
                  };
                  return (
                    <tr key={p.id} className="border-t border-ds-border">
                      <td className="px-3 py-2 font-medium text-ds-foreground">
                        {p.title}
                        {pendingId === p.id ? (
                          <span className="ml-2 text-[10px] font-normal text-ds-muted">Saving…</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className={dsSelectClass}
                          disabled={pendingId === p.id}
                          value={cfg.tier}
                          onChange={(e) => {
                            const tier = e.target.value as TrainingTier;
                            const next = { ...cfg, tier };
                            void (async () => {
                              setPendingId(p.id);
                              onSaveError(null);
                              try {
                                await persistRow(p.id, next);
                              } catch (ex) {
                                onSaveError(parseClientApiError(ex).message);
                              } finally {
                                setPendingId(null);
                              }
                            })();
                          }}
                        >
                          <option value="general">General</option>
                          <option value="mandatory">Mandatory</option>
                          <option value="high_risk">High risk</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          key={`${p.id}-due-${cfg.due_within_days ?? "x"}`}
                          className={dsInputClass}
                          type="number"
                          min={0}
                          placeholder="—"
                          disabled={pendingId === p.id}
                          defaultValue={cfg.due_within_days ?? ""}
                          onBlur={(e) => {
                            const raw = e.target.value;
                            const val = raw.trim() ? Math.max(0, Math.round(Number(raw))) : null;
                            const next = {
                              ...cfg,
                              due_within_days: Number.isFinite(val as number) ? val : null,
                            };
                            if (next.due_within_days === cfg.due_within_days) return;
                            void (async () => {
                              setPendingId(p.id);
                              onSaveError(null);
                              try {
                                await persistRow(p.id, next);
                              } catch (ex) {
                                onSaveError(parseClientApiError(ex).message);
                              } finally {
                                setPendingId(null);
                              }
                            })();
                          }}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-sm text-ds-foreground">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            disabled={pendingId === p.id}
                            checked={cfg.requires_acknowledgement}
                            onChange={(e) => {
                              const next = { ...cfg, requires_acknowledgement: e.target.checked };
                              void (async () => {
                                setPendingId(p.id);
                                onSaveError(null);
                                try {
                                  await persistRow(p.id, next);
                                } catch (ex) {
                                  onSaveError(parseClientApiError(ex).message);
                                } finally {
                                  setPendingId(null);
                                }
                              })();
                            }}
                          />
                          Track revision acknowledgements
                        </label>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
