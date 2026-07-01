"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchRecognitionFeed } from "@/lib/workerDevelopmentService";
import { fetchWorkerMeetings } from "@/lib/teamManagementMeetingsService";
import type { RecognitionFeedItem } from "@/lib/team-management/development-types";
import type { WorkerMeeting } from "@/lib/team-management/employee-profile/types";
import type { WorkerDevelopmentSummary } from "@/lib/team-management/development-types";

export type LeadershipTask = {
  id: string;
  at: string;
  kind: "meeting" | "review" | "milestone" | "training";
  title: string;
  subtitle?: string;
  href?: string;
};

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

export function useTeamLeadershipInsights(devRows: WorkerDevelopmentSummary[]) {
  const [recognition, setRecognition] = useState<RecognitionFeedItem[]>([]);
  const [meetings, setMeetings] = useState<WorkerMeeting[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [feed, meetingsRes] = await Promise.all([
        fetchRecognitionFeed(12).catch(() => ({ items: [] as RecognitionFeedItem[] })),
        fetchWorkerMeetings({ status: "upcoming" }).catch(() => ({ items: [] as WorkerMeeting[] })),
      ]);
      setRecognition(feed.items);
      setMeetings(meetingsRes.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const attention = useMemo(() => {
    const reviewsDue = devRows.filter((row) => {
      const days = daysUntil(row.next_review_date);
      return days != null && days >= 0 && days <= 30;
    });
    const noAssessment = devRows.filter((row) => !row.last_assessment_at);
    const upcomingMeetings = meetings.filter((m) => m.status === "upcoming");
    const actionRequired = devRows.filter(
      (row) => row.development_status === "action_required" || row.development_status === "needs_support",
    );

    return {
      reviewsDue,
      noAssessment,
      upcomingMeetings,
      actionRequired,
      overduePlans: 0,
      trainingExpiring: 0,
    };
  }, [devRows, meetings]);

  const leadershipTasks = useMemo((): LeadershipTask[] => {
    const tasks: LeadershipTask[] = [];
    for (const m of meetings) {
      if (!m.scheduled_date) continue;
      tasks.push({
        id: `meeting-${m.id}`,
        at: m.scheduled_date,
        kind: "meeting",
        title: `1:1 with ${m.employee_name || "employee"}`,
        subtitle: m.agenda || undefined,
        href: "/team-management/meetings/one-on-ones",
      });
    }
    for (const row of devRows) {
      if (!row.next_review_date) continue;
      const days = daysUntil(row.next_review_date);
      if (days == null || days < 0 || days > 14) continue;
      tasks.push({
        id: `review-${row.user_id}`,
        at: row.next_review_date,
        kind: "review",
        title: `Review · ${row.full_name || row.email}`,
        href: "/team-management/performance",
      });
    }
    tasks.sort((a, b) => a.at.localeCompare(b.at));
    return tasks.slice(0, 10);
  }, [meetings, devRows]);

  return { recognition, attention, leadershipTasks, loading, reload };
}
