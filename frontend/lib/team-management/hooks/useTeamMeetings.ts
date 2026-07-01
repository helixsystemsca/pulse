"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchMeetingActionItems,
  fetchWorkerMeetings,
} from "@/lib/teamManagementMeetingsService";
import type { MeetingActionItem, WorkerMeeting } from "@/lib/team-management/employee-profile/types";

export function useTeamMeetings(options?: { employeeUserId?: string; status?: string }) {
  const [meetings, setMeetings] = useState<WorkerMeeting[]>([]);
  const [actionItems, setActionItems] = useState<MeetingActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meetingsRes, itemsRes] = await Promise.all([
        fetchWorkerMeetings({
          employee_user_id: options?.employeeUserId,
          status: options?.status,
        }),
        fetchMeetingActionItems({
          employee_user_id: options?.employeeUserId,
          status: options?.status,
        }),
      ]);
      setMeetings(meetingsRes.items);
      setActionItems(itemsRes.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, [options?.employeeUserId, options?.status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { meetings, actionItems, loading, error, reload };
}
