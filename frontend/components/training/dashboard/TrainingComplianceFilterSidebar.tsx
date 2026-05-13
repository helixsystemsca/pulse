"use client";

import { Filter, X } from "lucide-react";
import { useState } from "react";
import { dsInputClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import { Button } from "@/components/ui/Button";
import type { DashboardComplianceFilter, TrainingDashboardFilters } from "@/lib/training/dashboardMetrics";
import { formatLabelTitleCase } from "@/lib/training/trainingRoleDisplay";
import {
  PROGRAM_DEPARTMENT_SCOPE_FILTER_VALUES,
  programDepartmentScopeFilterLabel,
} from "@/lib/training/departmentCategories";
import { cn } from "@/lib/cn";

const COMPLIANCE_OPTIONS: { value: DashboardComplianceFilter; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "compliant", label: "Compliant" },
  { value: "missing_mandatory", label: "Missing Routines" },
  { value: "expired", label: "Expired" },
  { value: "in_progress", label: "In Progress" },
];

function FilterFields({
  filters,
  onChange,
  departments,
  roles,
  shifts,
  categories,
}: {
  filters: TrainingDashboardFilters;
  onChange: (next: TrainingDashboardFilters) => void;
  departments: string[];
  roles: string[];
  shifts: string[];
  categories: string[];
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className={dsLabelClass} htmlFor="dash-filter-search">
          Search
        </label>
        <input
          id="dash-filter-search"
          className={dsInputClass}
          placeholder="Name, Department, Role"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
        />
      </div>
      <div>
        <label className={dsLabelClass} htmlFor="dash-filter-dept">
          Department
        </label>
        <select
          id="dash-filter-dept"
          className={dsSelectClass}
          value={filters.department}
          onChange={(e) => onChange({ ...filters, department: e.target.value })}
        >
          {departments.map((d) => (
            <option key={d} value={d}>
              {d === "all" ? "All Departments" : formatLabelTitleCase(d)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={dsLabelClass} htmlFor="dash-filter-role">
          Role
        </label>
        <select
          id="dash-filter-role"
          className={dsSelectClass}
          value={filters.role}
          onChange={(e) => onChange({ ...filters, role: e.target.value })}
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r === "all" ? "All Roles" : r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={dsLabelClass} htmlFor="dash-filter-shift">
          Shift
        </label>
        <select
          id="dash-filter-shift"
          className={dsSelectClass}
          value={filters.shift}
          onChange={(e) => onChange({ ...filters, shift: e.target.value })}
        >
          {shifts.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All Shifts" : s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={dsLabelClass} htmlFor="dash-filter-status">
          Status
        </label>
        <select
          id="dash-filter-status"
          className={dsSelectClass}
          value={filters.complianceFilter}
          onChange={(e) => onChange({ ...filters, complianceFilter: e.target.value as DashboardComplianceFilter })}
        >
          {COMPLIANCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={dsLabelClass} htmlFor="dash-filter-cat">
          Curriculum category
        </label>
        <select
          id="dash-filter-cat"
          className={dsSelectClass}
          value={filters.trainingCategory}
          onChange={(e) => onChange({ ...filters, trainingCategory: e.target.value })}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c === "all" ? "All categories" : formatLabelTitleCase(c)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={dsLabelClass} htmlFor="dash-filter-prog-dept">
          Department category
        </label>
        <select
          id="dash-filter-prog-dept"
          className={dsSelectClass}
          value={filters.programDepartmentCategory}
          onChange={(e) => onChange({ ...filters, programDepartmentCategory: e.target.value })}
        >
          {PROGRAM_DEPARTMENT_SCOPE_FILTER_VALUES.map((v) => (
            <option key={v} value={v}>
              {programDepartmentScopeFilterLabel(v)}
            </option>
          ))}
        </select>
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500/40"
          checked={filters.highRiskOnly}
          onChange={(e) => onChange({ ...filters, highRiskOnly: e.target.checked })}
        />
        High Risk Gaps Only
      </label>
    </div>
  );
}

export function TrainingComplianceFilterSidebar({
  filters,
  onChange,
  departments,
  roles,
  shifts,
  categories,
  className,
}: {
  filters: TrainingDashboardFilters;
  onChange: (next: TrainingDashboardFilters) => void;
  departments: string[];
  roles: string[];
  shifts: string[];
  categories: string[];
  className?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className={cn("lg:hidden", className)}>
        <Button
          type="button"
          variant="secondary"
          className="h-9 w-full justify-center gap-2 text-xs font-semibold"
          onClick={() => setMobileOpen(true)}
        >
          <Filter className="h-4 w-4" aria-hidden />
          Filters
        </Button>
      </div>

      <aside
        className={cn(
          "hidden w-56 shrink-0 lg:block",
          "sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm",
          "dark:border-slate-700/80 dark:bg-slate-900/50",
          className,
        )}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Filters</p>
        <div className="mt-3">
          <FilterFields
            filters={filters}
            onChange={onChange}
            departments={departments}
            roles={roles}
            shifts={shifts}
            categories={categories}
          />
        </div>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[140] lg:hidden" role="dialog" aria-modal aria-label="Filters">
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity"
            aria-label="Close filters"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[min(20rem,92vw)] flex-col border-r border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filters</p>
              <button
                type="button"
                className="rounded-md p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FilterFields
                filters={filters}
                onChange={onChange}
                departments={departments}
                roles={roles}
                shifts={shifts}
                categories={categories}
              />
            </div>
            <div className="border-t border-slate-100 p-3 dark:border-slate-800">
              <Button type="button" className="w-full" onClick={() => setMobileOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
