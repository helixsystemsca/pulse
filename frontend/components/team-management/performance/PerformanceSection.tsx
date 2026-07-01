"use client";

import { Loader2, Search, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { dsInputClass } from "@/components/ui/ds-form-classes";
import { TeamPerformanceMatrix } from "@/components/team-management/performance/components/TeamPerformanceMatrix";
import { TeamMemberDevelopmentCard } from "@/components/team-management/performance/components/TeamMemberDevelopmentCard";
import { Employee360Profile } from "@/components/team-management/employee-profile";
import type { WorkerDevelopmentSummary } from "@/lib/team-management/development-types";
import { useTeamEmployees } from "@/lib/team-management/hooks/useTeamEmployees";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 8;

export function PerformanceSection() {
  const { developmentByUserId, loading, error, reload, lastUpdatedAt } = useTeamEmployees();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const items = useMemo(
    () =>
      [...developmentByUserId.values()].filter((i) => i.is_active) as WorkerDevelopmentSummary[],
    [developmentByUserId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((row) => {
      if (statusFilter !== "all" && row.development_status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${row.full_name || ""} ${row.email} ${row.job_title || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const openProfile = (userId: string) => {
    setSelectedUserId(userId);
    setModalOpen(true);
  };

  const onUpdated = useCallback(async () => {
    await reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance"
        description="Team matrix, assessments, development plans, and review history."
        icon={TrendingUp}
      />
      <PageBody>
        {loading ? (
          <div className="flex min-h-[12rem] items-center justify-center text-ds-muted">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="text-sm text-ds-danger">{error}</p>
        ) : (
          <div className="space-y-8">
            <TeamPerformanceMatrix
              items={items}
              lastUpdatedAt={lastUpdatedAt}
              onSelectEmployee={openProfile}
            />

            <section aria-label="Team members">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-bold text-ds-foreground">Employee Assessments</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted"
                      aria-hidden
                    />
                    <input
                      type="search"
                      placeholder="Search team…"
                      className={cn(dsInputClass, "pl-9")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <select
                    className={cn(dsInputClass, "w-auto min-w-[9rem]")}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    aria-label="Filter by status"
                  >
                    <option value="all">All Status</option>
                    <option value="on_track">On Track</option>
                    <option value="developing">Developing</option>
                    <option value="needs_support">Needs Support</option>
                    <option value="action_required">Action Required</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {pageItems.map((emp) => (
                  <TeamMemberDevelopmentCard key={emp.user_id} employee={emp} onViewProfile={openProfile} />
                ))}
              </div>

              {filtered.length === 0 ? (
                <p className="mt-4 text-sm text-ds-muted">No team members match your filters.</p>
              ) : (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ds-muted">
                  <p>
                    Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of{" "}
                    {filtered.length} results
                  </p>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md border text-xs font-semibold",
                          n === page
                            ? "border-ds-accent bg-ds-secondary text-ds-foreground"
                            : "border-ds-border text-ds-muted hover:text-ds-foreground",
                        )}
                        onClick={() => setPage(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </PageBody>

      <Employee360Profile
        userId={selectedUserId}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpdated={() => void onUpdated()}
        initialTab="performance"
      />
    </div>
  );
}
