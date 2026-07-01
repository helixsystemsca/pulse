"use client";

import { useMemo } from "react";
import type { TeamOverviewData, TeamOverviewMilestone, TeamQuadrantCounts } from "@/lib/team-management/types";
import type { WorkerDevelopmentSummary } from "@/lib/team-management/development-types";
import { useTeamEmployees } from "@/lib/team-management/hooks/useTeamEmployees";
import { fetchWorkerDevelopmentDetail } from "@/lib/workerDevelopmentService";
import { useCallback, useEffect, useState } from "react";

const EMPTY_COUNTS: TeamQuadrantCounts = { A: 0, B: 0, C: 0, D: 0 };

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function useTeamOverviewData() {
  const { employees, developmentByUserId, loading, error, reload, lastUpdatedAt } = useTeamEmployees();
  const [milestones, setMilestones] = useState<TeamOverviewMilestone[]>([]);
  const [milestonesLoading, setMilestonesLoading] = useState(false);

  const loadMilestones = useCallback(async () => {
    const devRows = [...developmentByUserId.values()].filter((d) => d.is_active);
    if (devRows.length === 0) {
      setMilestones([]);
      return;
    }
    setMilestonesLoading(true);
    try {
      const details = await Promise.all(
        devRows.slice(0, 24).map((row) => fetchWorkerDevelopmentDetail(row.user_id)),
      );
      const upcoming: TeamOverviewMilestone[] = [];
      for (const detail of details) {
        const name = detail.full_name || detail.email;
        for (const item of detail.timeline) {
          if (item.status === "completed") continue;
          const due = daysUntil(item.scheduled_date);
          if (due == null || due < 0 || due > 90) continue;
          upcoming.push({
            id: item.id,
            userId: detail.user_id,
            employeeName: name,
            title: item.title,
            scheduledDate: item.scheduled_date ?? null,
            status: item.status,
          });
        }
      }
      upcoming.sort((a, b) => (a.scheduledDate || "").localeCompare(b.scheduledDate || ""));
      setMilestones(upcoming.slice(0, 8));
    } catch {
      setMilestones([]);
    } finally {
      setMilestonesLoading(false);
    }
  }, [developmentByUserId]);

  useEffect(() => {
    if (!loading && developmentByUserId.size > 0) {
      void loadMilestones();
    }
  }, [loading, developmentByUserId, loadMilestones]);

  const overview = useMemo((): TeamOverviewData => {
    const devRows = [...developmentByUserId.values()].filter((d) => d.is_active);
    const quadrantCounts: TeamQuadrantCounts = { ...EMPTY_COUNTS };
    let onTrackCount = 0;
    let needsAttentionCount = 0;

    for (const row of devRows) {
      quadrantCounts[row.development_quadrant] += 1;
      if (row.development_status === "on_track") onTrackCount += 1;
      if (row.development_status === "needs_support" || row.development_status === "action_required") {
        needsAttentionCount += 1;
      }
    }

    const reviewsDue = devRows
      .filter((row) => {
        const days = daysUntil(row.next_review_date);
        return days != null && days >= 0 && days <= 30;
      })
      .sort((a, b) => (a.next_review_date || "").localeCompare(b.next_review_date || ""));

    return {
      employees,
      quadrantCounts,
      reviewsDue,
      developmentMilestones: milestones,
      onTrackCount,
      needsAttentionCount,
      lastUpdatedAt,
    };
  }, [employees, developmentByUserId, milestones, lastUpdatedAt]);

  return {
    ...overview,
    developmentByUserId,
    loading: loading || milestonesLoading,
    error,
    reload: async () => {
      await reload();
      await loadMilestones();
    },
  };
}

export function upcomingAnniversaries(devRows: WorkerDevelopmentSummary[], withinDays = 30) {
  const today = new Date();
  return devRows
    .filter((row) => row.start_date)
    .map((row) => {
      const start = new Date(`${row.start_date}T12:00:00`);
      const anniversary = new Date(today.getFullYear(), start.getMonth(), start.getDate());
      if (anniversary < today) anniversary.setFullYear(today.getFullYear() + 1);
      const days = Math.round((anniversary.getTime() - today.setHours(0, 0, 0, 0)) / 86_400_000);
      return { row, days, anniversary };
    })
    .filter((x) => x.days >= 0 && x.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}
