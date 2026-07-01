"use client";

import { ArrowRight, ExternalLink, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DevelopmentEmployeeAvatar } from "@/components/team-management/performance/components/DevelopmentEmployeeAvatar";
import { Employee360Profile } from "@/components/team-management/employee-profile";
import { Button } from "@/components/ui/Button";
import { dsInputClass } from "@/components/ui/ds-form-classes";
import { useTeamEmployees } from "@/lib/team-management/hooks/useTeamEmployees";
import { QUADRANT_META, STATUS_META, displayName } from "@/lib/team-management/development-types";
import { cn } from "@/lib/cn";

export function EmployeeDirectory() {
  const { employees, loading, error, reload } = useTeamEmployees();
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => {
      const hay = `${e.full_name || ""} ${e.email} ${e.job_title || ""} ${e.department || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [employees, search]);

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-ds-muted">
          {filtered.length} employee{filtered.length === 1 ? "" : "s"} · sourced from Team Roster
        </p>
        <div className="relative min-w-[12rem] sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search directory…"
            className={cn(dsInputClass, "pl-9")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[8rem] items-center justify-center text-ds-muted">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <p className="text-sm text-ds-danger">{error}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-ds-border/60">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-ds-border/60 bg-ds-secondary/40 text-[11px] font-bold uppercase tracking-wide text-ds-muted">
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Position</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Quadrant</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((emp) => {
                const dev = emp.development;
                const q = dev?.development_quadrant ?? "C";
                const qMeta = QUADRANT_META[q];
                const status = dev?.development_status ?? "developing";
                return (
                  <tr key={emp.id} className="border-b border-ds-border/40 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <DevelopmentEmployeeAvatar
                          avatarUrl={emp.avatar_url}
                          fullName={emp.full_name}
                          email={emp.email}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ds-foreground">
                            {displayName({ full_name: emp.full_name, email: emp.email })}
                          </p>
                          <p className="truncate text-xs text-ds-muted">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ds-muted">{emp.job_title || "—"}</td>
                    <td className="px-4 py-3 text-ds-muted">{emp.department || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", qMeta.badgeClass)}>
                        {qMeta.shortLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold",
                          STATUS_META[status].badgeClass,
                        )}
                      >
                        {STATUS_META[status].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 px-2 text-xs"
                          onClick={() => {
                            setSelectedUserId(emp.id);
                            setModalOpen(true);
                          }}
                        >
                          Profile
                          <ArrowRight className="ml-1 h-3 w-3" aria-hidden />
                        </Button>
                        <Link
                          href={`/dashboard/permissions?profile=${emp.id}`}
                          className="inline-flex h-8 items-center rounded-md border border-ds-border px-2 text-xs font-semibold text-ds-muted hover:text-ds-foreground"
                          title="Full HR profile & permissions"
                        >
                          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Employee360Profile
        userId={selectedUserId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdated={() => void reload()}
      />
    </>
  );
}
