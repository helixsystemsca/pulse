"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Grid3X3,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { dsInputClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import {
  MOCK_TRAINING_ACKNOWLEDGEMENTS,
  MOCK_TRAINING_EMPLOYEES,
  MOCK_TRAINING_PROGRAMS,
  MOCK_RESOLVED_ASSIGNMENTS,
} from "@/lib/training/mockData";
import type {
  MatrixAdminOverride,
  TrainingAcknowledgement,
  TrainingAssignment,
  TrainingEmployee,
  TrainingProgram,
  TrainingTier,
} from "@/lib/training/types";
import { assignmentFor, passesMatrixFilters, uniqueDepartments, type TrainingMatrixFilters } from "@/lib/training/selectors";
import {
  buildEmployeeComplianceRows,
  buildEmployeeDrawerLines,
  buildExpiringSoonRows,
  computeDashboardKpis,
  filterDashboardEmployees,
  type EmployeeComplianceRowModel,
  type TrainingDashboardFilters,
  type TrainingDashboardTab,
  type WorkerTrainingMeta,
  uniqueProgramCategories,
} from "@/lib/training/dashboardMetrics";
import { KPIStatCard } from "@/components/training/dashboard/KPIStatCard";
import { TrainingComplianceFilterSidebar } from "@/components/training/dashboard/TrainingComplianceFilterSidebar";
import { EmployeeComplianceOverviewTable } from "@/components/training/dashboard/EmployeeComplianceOverviewTable";
import { EmployeeTrainingDrawer } from "@/components/training/dashboard/EmployeeTrainingDrawer";
import { TrainingMatrixCategorizedTable } from "@/components/training/dashboard/TrainingMatrixCategorizedTable";
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
import { nextMatrixAdminOverride } from "@/lib/training/matrixAdminOverride";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { notifyLeadershipMandatoryOverdue } from "@/lib/training/notifications";
import { listProcedureSignoffs } from "@/lib/procedureSignoffs";
import { trainingMatrixAdminOverrideAllowed, trainingTeamMatrixAccess } from "@/lib/pulse-roles";
import { formatLabelTitleCase, rolesForTrainingDropdown } from "@/lib/training/trainingRoleDisplay";
import {
  fetchTrainingMatrix,
  mapApiAssignments,
  mapApiEmployees,
  mapApiPrograms,
  patchProcedureCompliance,
  patchTrainingAssignmentMatrixOverride,
  postTrainingAssignments,
  trainingProgramsToComplianceMap,
} from "@/lib/trainingApi";
import { cn } from "@/lib/cn";

const STATUS_OPTIONS: Array<{ value: TrainingAssignment["status"] | "all"; label: string }> = [
  { value: "all", label: "Any Status" },
  { value: "completed", label: "Verified Complete" },
  { value: "expiring_soon", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Not Started" },
  { value: "in_progress", label: "Reviewing" },
  { value: "acknowledged", label: "Acknowledged (Quiz Pending)" },
  { value: "quiz_failed", label: "Knowledge Check — Retry" },
  { value: "revision_pending", label: "Revision Pending" },
  { value: "not_assigned", label: "Not Assigned" },
  { value: "not_applicable", label: "Not Applicable" },
];

/** Matrix tab: one tier at a time (default Mandatory) — no "all" columns. */
const MATRIX_TIER_OPTIONS: Array<{ value: TrainingTier; label: string }> = [
  { value: "mandatory", label: "Mandatory" },
  { value: "high_risk", label: "High Risk" },
  { value: "general", label: "General" },
];

const TAB_DEF: { id: TrainingDashboardTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "employees", label: "Employees", icon: Users },
  { id: "matrix", label: "Training Matrix", icon: Grid3X3 },
  { id: "expiring", label: "Expiring Soon", icon: Clock },
  { id: "reports", label: "Reports", icon: BarChart3 },
];

type MatrixBundle = {
  employees: TrainingEmployee[];
  programs: TrainingProgram[];
  assignments: TrainingAssignment[];
};

const defaultDashboardFilters = (): TrainingDashboardFilters => ({
  search: "",
  department: "all",
  role: "all",
  shift: "all",
  complianceFilter: "all",
  trainingCategory: "all",
  highRiskOnly: false,
});

export function TrainingLeadershipDashboard() {
  const api = isApiMode();
  const [tab, setTab] = useState<TrainingDashboardTab>("overview");
  const [dashboardFilters, setDashboardFilters] = useState<TrainingDashboardFilters>(defaultDashboardFilters);
  const [matrixFilters, setMatrixFilters] = useState<TrainingMatrixFilters>({
    department: "all",
    tier: "mandatory",
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
  const [workerMeta, setWorkerMeta] = useState<Record<string, WorkerTrainingMeta>>({});
  const [drawerRow, setDrawerRow] = useState<EmployeeComplianceRowModel | null>(null);
  const [matrixLocalOverrides, setMatrixLocalOverrides] = useState<Record<string, MatrixAdminOverride>>({});
  const [matrixCellBusyKey, setMatrixCellBusyKey] = useState<string | null>(null);
  const [matrixCellErr, setMatrixCellErr] = useState<string | null>(null);
  const matrixCycleLockRef = useRef(false);

  useEffect(() => {
    if (matrixBundle) setMatrixLocalOverrides({});
  }, [matrixBundle]);

  useEffect(() => {
    setMatrixFilters((m) => ({
      ...m,
      department: dashboardFilters.department,
      search: dashboardFilters.search,
    }));
  }, [dashboardFilters.department, dashboardFilters.search]);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    void (async () => {
      try {
        const session = readSession();
        const w = await fetchWorkerList(session?.company_id ?? null, { include_inactive: false });
        if (cancelled) return;
        const map: Record<string, WorkerTrainingMeta> = {};
        for (const x of w.items ?? []) {
          if (!x.is_active) continue;
          map[x.id] = { role: x.role, shift: x.shift ?? null };
        }
        setWorkerMeta(map);
      } catch {
        if (!cancelled) setWorkerMeta({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

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

  const assignmentsForMatrix = useMemo(() => {
    if (trustServerStatus) return generated.assignments;
    if (Object.keys(matrixLocalOverrides).length === 0) return generated.assignments;
    return generated.assignments.map((a) => {
      const k = `${a.employee_id}:${a.training_program_id}`;
      if (!(k in matrixLocalOverrides)) return a;
      return { ...a, matrix_admin_override: matrixLocalOverrides[k] };
    });
  }, [trustServerStatus, generated.assignments, matrixLocalOverrides]);

  const canMatrixAdminEditCells =
    trainingMatrixAdminOverrideAllowed(readSession()) && (!trustServerStatus || api);

  const handleMatrixAdminCellCycle = useCallback(
    async (employeeId: string, programId: string) => {
      if (!canMatrixAdminEditCells) return;
      if (matrixCycleLockRef.current) return;
      const key = `${employeeId}:${programId}`;
      matrixCycleLockRef.current = true;
      setMatrixCellBusyKey(key);
      setMatrixCellErr(null);
      try {
        if (trustServerStatus) {
          if (!api) return;
          const snapshotBefore = matrixBundle?.assignments ?? [];
          const a = assignmentFor(employeeId, programId, snapshotBefore);
          let curOv = a?.matrix_admin_override ?? null;
          let assignId = a?.id;

          if (!a) {
            const created = await postTrainingAssignments({
              procedure_id: programId,
              employee_user_ids: [employeeId],
              use_compliance_due_window: true,
            });
            const newA =
              created.find((x) => x.employee_id === employeeId && x.training_program_id === programId) ??
              created[0];
            if (!newA?.id) return;
            assignId = newA.id;
            curOv = null;
            setMatrixBundle((prev) => {
              if (!prev) return prev;
              const rest = prev.assignments.filter(
                (x) => !(x.employee_id === employeeId && x.training_program_id === programId),
              );
              return { ...prev, assignments: [...rest, newA] };
            });
          }

          if (!assignId) return;
          const nextOv = nextMatrixAdminOverride(curOv);
          const updated = await patchTrainingAssignmentMatrixOverride(assignId, {
            matrix_admin_override: nextOv,
          });
          setMatrixBundle((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              assignments: prev.assignments.map((x) => (x.id === updated.id ? updated : x)),
            };
          });
        } else {
          setMatrixLocalOverrides((prev) => {
            const k2 = `${employeeId}:${programId}`;
            const cur =
              prev[k2] ??
              assignmentFor(employeeId, programId, generated.assignments)?.matrix_admin_override ??
              null;
            const next = nextMatrixAdminOverride(cur);
            if (next == null) {
              const n = { ...prev };
              delete n[k2];
              return n;
            }
            return { ...prev, [k2]: next };
          });
        }
      } catch (me: unknown) {
        setMatrixCellErr(parseClientApiError(me).message);
      } finally {
        matrixCycleLockRef.current = false;
        setMatrixCellBusyKey(null);
      }
    },
    [api, trustServerStatus, matrixBundle, generated.assignments, canMatrixAdminEditCells],
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => passesMatrixFilters(e, matrixFilters));
  }, [employees, matrixFilters]);

  const matrixPrograms = useMemo(() => {
    const tier = matrixFilters.tier === "all" ? "mandatory" : matrixFilters.tier;
    return programs.filter((p) => p.tier === tier);
  }, [programs, matrixFilters.tier]);

  const rowModels = useMemo(
    () =>
      buildEmployeeComplianceRows(
        filteredEmployees,
        programs,
        generated.assignments,
        generated.acknowledgements,
        workerMeta,
        { trustAssignmentStatus: trustServerStatus },
      ),
    [filteredEmployees, programs, generated.assignments, generated.acknowledgements, workerMeta, trustServerStatus],
  );

  const filteredRows = useMemo(
    () =>
      filterDashboardEmployees(
        rowModels,
        dashboardFilters,
        programs,
        generated.assignments,
        generated.acknowledgements,
        { trustAssignmentStatus: trustServerStatus },
      ),
    [
      rowModels,
      dashboardFilters,
      programs,
      generated.assignments,
      generated.acknowledgements,
      trustServerStatus,
    ],
  );

  const kpis = useMemo(
    () =>
      computeDashboardKpis(employees, programs, generated.assignments, generated.acknowledgements, {
        trustAssignmentStatus: trustServerStatus,
      }),
    [employees, programs, generated.assignments, generated.acknowledgements, trustServerStatus],
  );

  const departments = useMemo(() => ["all", ...uniqueDepartments(employees)], [employees]);

  const roles = useMemo(() => rolesForTrainingDropdown(workerMeta), [workerMeta]);

  const shifts = useMemo(() => {
    const s = new Set<string>();
    for (const m of Object.values(workerMeta)) {
      if (m.shift?.trim()) s.add(formatLabelTitleCase(m.shift.trim()));
    }
    return ["all", ...[...s].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))];
  }, [workerMeta]);

  const categories = useMemo(() => ["all", ...uniqueProgramCategories(programs)], [programs]);

  const configRows = useMemo(() => {
    if (matrixBundle) return matrixBundle.programs.map((p) => ({ id: p.id, title: p.title }));
    if (procedures?.length) return procedures.map((p) => ({ id: p.id, title: p.title }));
    return [];
  }, [matrixBundle, procedures]);

  const expiringRows = useMemo(
    () =>
      buildExpiringSoonRows(
        filteredEmployees,
        programs,
        generated.assignments,
        generated.acknowledgements,
        { trustAssignmentStatus: trustServerStatus },
      ),
    [filteredEmployees, programs, generated.assignments, generated.acknowledgements, trustServerStatus],
  );

  const drawerLines = useMemo(() => {
    if (!drawerRow) return [];
    return buildEmployeeDrawerLines(
      drawerRow.employee.id,
      programs,
      generated.assignments,
      generated.acknowledgements,
      { trustAssignmentStatus: trustServerStatus },
    );
  }, [drawerRow, programs, generated.assignments, generated.acknowledgements, trustServerStatus]);

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
    <div className="min-w-0 space-y-6">
      <header className="flex flex-col gap-3 border-b border-slate-200/90 pb-4 dark:border-slate-800">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50">Training compliance</h2>
            <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              Operations dashboard for workforce readiness — mandatory onboarding, high-risk coverage, and expiries.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="h-9 shrink-0 gap-2 px-3 text-xs"
            onClick={() => setConfigOpen(true)}
          >
            <Settings className="h-4 w-4" aria-hidden />
            Configure procedure tiers
          </Button>
        </div>

        <nav className="flex gap-1 overflow-x-auto pb-0.5" aria-label="Training sections">
          {TAB_DEF.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition",
                  active
                    ? "bg-slate-900 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/80",
                )}
              >
                <Icon className="h-4 w-4 opacity-80" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        {loading ? <span>Loading…</span> : null}
        {!loading && err ? <span className="font-semibold text-rose-600">Live data unavailable: {err}</span> : null}
        {!loading && matrixErr ? <span className="font-semibold text-rose-600">Training matrix: {matrixErr}</span> : null}
        {!loading && api && !err && matrixBundle ? <span>Matrix and tiers are loaded from the server.</span> : null}
        {!loading && api && !err && !matrixBundle ? (
          <span>Using roster + procedures with demo statuses until the training API is available.</span>
        ) : null}
      </div>

      {tab === "overview" ? (
        <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
          <TrainingComplianceFilterSidebar
            filters={dashboardFilters}
            onChange={setDashboardFilters}
            departments={departments}
            roles={roles}
            shifts={shifts}
            categories={categories}
          />
          <div className="min-w-0 flex-1 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <KPIStatCard label="Total employees" value={kpis.totalEmployees} icon={Users} accent="neutral" />
              <KPIStatCard label="Fully compliant" value={kpis.fullyCompliant} icon={ShieldCheck} accent="success" />
              <KPIStatCard
                label="Missing mandatory"
                value={kpis.missingMandatoryEmployees}
                icon={AlertTriangle}
                accent="danger"
              />
              <KPIStatCard label="Expiring soon" value={kpis.expiringSoonEmployees} icon={Clock} accent="warning" />
              <KPIStatCard label="High risk gaps" value={kpis.highRiskGaps} icon={ShieldAlert} accent="warning" />
            </div>
            <EmployeeComplianceOverviewTable
              rows={filteredRows}
              dense
              onRowOpen={(r) => {
                setDrawerRow(r);
              }}
            />
          </div>
        </div>
      ) : null}

      {tab === "employees" ? (
        <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
          <TrainingComplianceFilterSidebar
            filters={dashboardFilters}
            onChange={setDashboardFilters}
            departments={departments}
            roles={roles}
            shifts={shifts}
            categories={categories}
          />
          <div className="min-w-0 flex-1">
            <EmployeeComplianceOverviewTable
              rows={filteredRows}
              dense={false}
              onRowOpen={(r) => {
                setDrawerRow(r);
              }}
            />
          </div>
        </div>
      ) : null}

      {tab === "matrix" ? (
        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="grid flex-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={dsLabelClass} htmlFor="mx-tier">
                  Column Tier
                </label>
                <select
                  id="mx-tier"
                  className={dsSelectClass}
                  value={matrixFilters.tier === "all" ? "mandatory" : matrixFilters.tier}
                  onChange={(e) =>
                    setMatrixFilters((f) => ({
                      ...f,
                      tier: e.target.value as Exclude<TrainingMatrixFilters["tier"], "all">,
                    }))
                  }
                >
                  {MATRIX_TIER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={dsLabelClass} htmlFor="mx-status">
                  Highlight Status
                </label>
                <select
                  id="mx-status"
                  className={dsSelectClass}
                  value={matrixFilters.status}
                  onChange={(e) =>
                    setMatrixFilters((f) => ({ ...f, status: e.target.value as TrainingMatrixFilters["status"] }))
                  }
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={dsLabelClass} htmlFor="mx-search">
                  Employee Search
                </label>
                <input
                  id="mx-search"
                  className={dsInputClass}
                  placeholder="Name Or Department"
                  value={matrixFilters.search}
                  onChange={(e) => setMatrixFilters((f) => ({ ...f, search: e.target.value }))}
                />
              </div>
            </div>
          </div>
          {canMatrixAdminEditCells ? (
            <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              As company admin, click any matrix cell to cycle: default (computed) → shown complete → shown not
              complete → not applicable → default. This updates the live roster when the training API is in use;
              otherwise it adjusts this browser session only.
            </p>
          ) : null}
          {matrixCellErr ? <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{matrixCellErr}</p> : null}
          <TrainingMatrixCategorizedTable
            employees={filteredEmployees}
            programs={matrixPrograms}
            assignments={assignmentsForMatrix}
            acknowledgements={generated.acknowledgements}
            trustAssignmentStatus={trustServerStatus}
            statusColumnFilter={matrixFilters.status}
            matrixAdminCellEditable={canMatrixAdminEditCells}
            onMatrixAdminCellCycle={handleMatrixAdminCellCycle}
            matrixCycleBusyKey={matrixCellBusyKey}
          />
        </section>
      ) : null}

      {tab === "expiring" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/90 text-left dark:border-slate-800 dark:bg-slate-900/80">
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Employee</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Training</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Expires</th>
                  <th className="px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">Tier</th>
                </tr>
              </thead>
              <tbody>
                {expiringRows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                      No expiring certifications for the current employee filters.
                    </td>
                  </tr>
                ) : (
                  expiringRows.map((r) => (
                    <tr key={`${r.employee.id}-${r.program.id}`} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="px-3 py-2 font-medium text-slate-900 dark:text-slate-100">{r.employee.display_name}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.program.title}</td>
                      <td className="px-3 py-2 tabular-nums text-slate-600 dark:text-slate-300">{r.expiryDate}</td>
                      <td className="px-3 py-2 text-xs uppercase text-slate-500">{r.program.tier.replace("_", " ")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "reports" ? (
        <Card className="border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/50">
          <p className="text-base font-semibold text-slate-900 dark:text-slate-50">Reports & exports</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Compliance PDFs, audit exports, and scheduled digest emails will appear here. Notifications today are routed
            through{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">lib/training/notifications.ts</code>
            .
          </p>
        </Card>
      ) : null}

      <EmployeeTrainingDrawer open={Boolean(drawerRow)} onClose={() => setDrawerRow(null)} row={drawerRow} lines={drawerLines} />

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
