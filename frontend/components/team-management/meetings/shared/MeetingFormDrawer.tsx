"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { Button } from "@/components/ui/Button";
import { dsInputStackedClass, dsLabelClass, dsSelectClass } from "@/components/ui/ds-form-classes";
import type { WorkerMeeting } from "@/lib/team-management/employee-profile/types";
import { createWorkerMeeting, patchWorkerMeeting } from "@/lib/teamManagementMeetingsService";
import { useTeamEmployees } from "@/lib/team-management/hooks/useTeamEmployees";
import { cn } from "@/lib/cn";

type FormState = {
  employee_user_id: string;
  meeting_type: string;
  scheduled_date: string;
  status: string;
  agenda: string;
  wins: string;
  challenges: string;
  goals: string;
  manager_notes: string;
  employee_notes: string;
  next_meeting_date: string;
  recurrence: string;
};

const EMPTY: FormState = {
  employee_user_id: "",
  meeting_type: "one_on_one",
  scheduled_date: "",
  status: "upcoming",
  agenda: "",
  wins: "",
  challenges: "",
  goals: "",
  manager_notes: "",
  employee_notes: "",
  next_meeting_date: "",
  recurrence: "",
};

export function MeetingFormDrawer({
  open,
  onClose,
  meeting,
  defaultMeetingType = "one_on_one",
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  meeting?: WorkerMeeting | null;
  defaultMeetingType?: string;
  onSaved: () => void;
}) {
  const { employees } = useTeamEmployees();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (meeting) {
      setForm({
        employee_user_id: meeting.employee_user_id,
        meeting_type: meeting.meeting_type,
        scheduled_date: meeting.scheduled_date?.slice(0, 10) ?? "",
        status: meeting.status,
        agenda: meeting.agenda ?? "",
        wins: meeting.wins ?? "",
        challenges: meeting.challenges ?? "",
        goals: meeting.goals ?? "",
        manager_notes: meeting.manager_notes ?? "",
        employee_notes: meeting.employee_notes ?? "",
        next_meeting_date: meeting.next_meeting_date?.slice(0, 10) ?? "",
        recurrence: meeting.recurrence ?? "",
      });
    } else {
      setForm({ ...EMPTY, meeting_type: defaultMeetingType });
    }
    setError(null);
  }, [open, meeting, defaultMeetingType]);

  const save = async () => {
    if (!meeting && !form.employee_user_id) {
      setError("Select an employee");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        scheduled_date: form.scheduled_date || null,
        status: form.status,
        agenda: form.agenda || null,
        wins: form.wins || null,
        challenges: form.challenges || null,
        goals: form.goals || null,
        manager_notes: form.manager_notes || null,
        employee_notes: form.employee_notes || null,
        next_meeting_date: form.next_meeting_date || null,
        recurrence: form.recurrence || null,
      };
      if (meeting) {
        await patchWorkerMeeting(meeting.id, body);
      } else {
        await createWorkerMeeting({
          employee_user_id: form.employee_user_id,
          meeting_type: form.meeting_type,
          ...body,
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save meeting");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PulseDrawer
      open={open}
      onClose={onClose}
      title={meeting ? "Edit Meeting" : "Schedule Meeting"}
      placement="center"
      wide
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Save"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-ds-danger">{error}</p> : null}
        {!meeting ? (
          <div>
            <label className={dsLabelClass} htmlFor="meeting-employee">
              Employee
            </label>
            <select
              id="meeting-employee"
              className={cn(dsSelectClass, "mt-1.5")}
              value={form.employee_user_id}
              onChange={(e) => setForm({ ...form, employee_user_id: e.target.value })}
            >
              <option value="">Select employee…</option>
              {employees
                .filter((e) => e.is_active)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.full_name || e.email}
                  </option>
                ))}
            </select>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={dsLabelClass} htmlFor="meeting-date">
              Date
            </label>
            <input
              id="meeting-date"
              type="date"
              className={dsInputStackedClass}
              value={form.scheduled_date}
              onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
            />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="meeting-status">
              Status
            </label>
            <select
              id="meeting-status"
              className={cn(dsSelectClass, "mt-1.5")}
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="upcoming">Upcoming</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        {(["agenda", "wins", "challenges", "goals", "manager_notes", "employee_notes"] as const).map((field) => (
          <div key={field}>
            <label className={dsLabelClass} htmlFor={`meeting-${field}`}>
              {field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </label>
            <textarea
              id={`meeting-${field}`}
              rows={field === "agenda" ? 3 : 2}
              className={cn(dsInputStackedClass, "resize-y")}
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={dsLabelClass} htmlFor="meeting-next">
              Next Meeting Date
            </label>
            <input
              id="meeting-next"
              type="date"
              className={dsInputStackedClass}
              value={form.next_meeting_date}
              onChange={(e) => setForm({ ...form, next_meeting_date: e.target.value })}
            />
          </div>
          <div>
            <label className={dsLabelClass} htmlFor="meeting-recurrence">
              Recurrence
            </label>
            <input
              id="meeting-recurrence"
              className={dsInputStackedClass}
              placeholder="e.g. weekly, biweekly"
              value={form.recurrence}
              onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
            />
          </div>
        </div>
      </div>
    </PulseDrawer>
  );
}
