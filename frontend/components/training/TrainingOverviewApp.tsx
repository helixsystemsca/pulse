"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { dsInputClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import {
  MOCK_TRAINING_ACKNOWLEDGEMENTS,
  MOCK_TRAINING_EMPLOYEES,
  MOCK_TRAINING_PROGRAMS,
  MOCK_RESOLVED_ASSIGNMENTS,
} from "@/lib/training/mockData";
import type { TrainingAssignmentStatus, TrainingTier } from "@/lib/training/types";
import {
  computeComplianceSummary,
  filterEmployees,
  passesMatrixFilters,
  uniqueDepartments,
  type TrainingMatrixFilters,
} from "@/lib/training/selectors";
import { TrainingMatrixTable } from "@/components/training/TrainingMatrixTable";
import { TrainingSummaryCards } from "@/components/training/TrainingSummaryCards";

const STATUS_OPTIONS: Array<{ value: TrainingAssignmentStatus | "all"; label: string }> = [
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

export function TrainingOverviewApp() {
  const [filters, setFilters] = useState<TrainingMatrixFilters>({
    department: "all",
    tier: "all",
    status: "all",
    expiringSoonOnly: false,
    search: "",
  });

  const departments = useMemo(() => ["all", ...uniqueDepartments(MOCK_TRAINING_EMPLOYEES)], []);

  const filteredEmployees = useMemo(() => {
    let rows = MOCK_TRAINING_EMPLOYEES;
    rows = filterEmployees(rows, filters.search);
    if (filters.department !== "all") {
      rows = rows.filter((e) => e.department === filters.department);
    }
    rows = rows.filter((e) =>
      passesMatrixFilters(e, MOCK_TRAINING_PROGRAMS, MOCK_RESOLVED_ASSIGNMENTS, MOCK_TRAINING_ACKNOWLEDGEMENTS, filters),
    );
    return rows;
  }, [filters]);

  const summary = useMemo(
    () => computeComplianceSummary(MOCK_TRAINING_EMPLOYEES, MOCK_TRAINING_PROGRAMS, MOCK_RESOLVED_ASSIGNMENTS, MOCK_TRAINING_ACKNOWLEDGEMENTS),
    [],
  );

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-ds-border bg-ds-primary/80 p-4 shadow-[var(--ds-shadow-card)] sm:p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--ds-accent)_14%,transparent)] text-[var(--ds-accent)]">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ds-foreground">Training & compliance</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ds-muted">
              Operational visibility for onboarding, certifications, and high-risk competencies. Acknowledgements and
              revision cycles are tracked for audit readiness. Demo data below — connect HR / LMS when ready.
            </p>
            <p className="mt-2 text-xs font-medium text-ds-muted">
              Supervisors: use{" "}
              <Link href="/dashboard/workers" className="ds-link font-semibold">
                Team Management
              </Link>{" "}
              → open a profile → <span className="font-semibold text-ds-foreground">Training matrix</span> tab.
            </p>
          </div>
        </div>
      </div>

      <TrainingSummaryCards summary={summary} />

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-ds-muted">Training matrix</h3>
            <p className="mt-1 text-sm text-ds-muted">Rows = people · Columns = programs · Chips = status</p>
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-ds-border bg-ds-secondary/40 p-4 lg:grid-cols-6">
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
          <div className="flex flex-col justify-end">
            <label className={`${dsLabelClass} flex cursor-pointer items-center gap-2`}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-ds-border"
                checked={filters.expiringSoonOnly}
                onChange={(e) => setFilters((f) => ({ ...f, expiringSoonOnly: e.target.checked }))}
              />
              Expiring soon only
            </label>
          </div>
        </div>

        <TrainingMatrixTable
          employees={filteredEmployees}
          programs={MOCK_TRAINING_PROGRAMS}
          assignments={MOCK_RESOLVED_ASSIGNMENTS}
          acknowledgements={MOCK_TRAINING_ACKNOWLEDGEMENTS}
        />
      </section>

      <section className="rounded-xl border border-ds-border bg-ds-secondary/30 p-4 text-sm text-ds-muted">
        <p className="font-semibold text-ds-foreground">Notifications (stub)</p>
        <p className="mt-2 leading-relaxed">
          Expiry, overdue mandatory, new assignments, and revision acknowledgements emit through{" "}
          <code className="rounded bg-ds-primary px-1 py-0.5 font-mono text-xs">lib/training/notifications.ts</code> —
          wire to email / Teams / push when integrations land.
        </p>
      </section>
    </div>
  );
}
