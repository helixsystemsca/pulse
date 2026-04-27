"use client";

import {
  BarChart2,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Save,
  Settings,
  User,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsGear } from "@/components/settings/SettingsGear";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, isApiMode, refreshPulseUserFromServer } from "@/lib/api";
import { getServerDate } from "@/lib/serverTime";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { patchOnboarding } from "@/lib/onboardingService";
import { listProjects, type ProjectRow } from "@/lib/projectsService";
import { getOrAssignProjectTintClass } from "@/lib/schedule/project-overlay-tints";
import type { ProjectBarItem } from "@/lib/schedule/project-schedule-bars";
import {
  addDaysToIso,
  formatLocalDate,
  mondayOfCalendarWeek,
  monthGrid,
  parseLocalDate,
  weekDatesFromSunday,
} from "@/lib/schedule/calendar";
import { evaluateCoverageRules } from "@/lib/schedule/coverage-rules";
import {
  inferShiftTypeFromStart,
  isEphemeralScheduleShiftId,
  mergeEphemeralSchedule,
  normalizeWeekdayKey,
  weekdayKeyFromIso,
} from "@/lib/schedule/recurring";
import { suggestReplacementLabel } from "@/lib/schedule/suggest-replacement";
import { buildWorkerDragHighlightMap, evaluateWorkerDrop } from "@/lib/schedule/worker-drag-highlights";
import {
  isPulseApiShiftId,
  localDateTimeToIso,
  pulseShiftsToSchedule,
  pulseWorkersToSchedule,
  pulseZonesToSchedule,
  type PulseShiftApi,
  type PulseWorkerApi,
  type PulseZoneApi,
} from "@/lib/schedule/pulse-bridge";
import { computeAlerts, computeWorkforceSummary } from "@/lib/schedule/selectors";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import type { ScheduleDragSession, Shift } from "@/lib/schedule/types";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { readSession } from "@/lib/pulse-session";
import { ScheduleAlertsBanner } from "./ScheduleAlertsBanner";
import { useModuleSettings } from "@/providers/ModuleSettingsProvider";
import { ScheduleCalendarGrid } from "./ScheduleCalendarGrid";
import { ScheduleDayView } from "./ScheduleDayView";
import { ScheduleLegendPanel, type ScheduleProjectLegendItem } from "./ScheduleLegendPanel";
import { ScheduleMyShiftsView } from "./ScheduleMyShiftsView";
import { SchedulePersonnel } from "./SchedulePersonnel";
import { ScheduleReports } from "./ScheduleReports";
import { ScheduleSettingsModal } from "./ScheduleSettingsModal";
import { ScheduleTrashDropZone } from "./ScheduleTrashDropZone";
import { Card } from "@/components/pulse/Card";
import { ScheduleWeekView } from "./ScheduleWeekView";
import { ScheduleWorkerPanel } from "./ScheduleWorkerPanel";
import { ScheduleWorkforceBar } from "./ScheduleWorkforceBar";
import type { ShiftDraft } from "./ShiftEditModal";
import { ShiftEditModal } from "./ShiftEditModal";
import { TimeOffRequestModal } from "./TimeOffRequestModal";

type View = "calendar" | "personnel" | "reports" | "my-shifts";
type CalendarScale = "month" | "week" | "day";
type ScheduleContentFilter = "workers" | "projects" | "combined";

function shiftLengthHours(sh: Pick<Shift, "startTime" | "endTime">): number {
  const [shh, smm] = sh.startTime.split(":").map(Number);
  const [ehh, emm] = sh.endTime.split(":").map(Number);
  if (![shh, smm, ehh, emm].every((n) => Number.isFinite(n))) return 0;
  let mins = ehh * 60 + emm - (shh * 60 + smm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

function weeklyAssignedHours(
  shifts: Shift[],
  workerId: string,
  anyDateInWeek: string,
  omitShiftId?: string,
): number {
  const mon = mondayOfCalendarWeek(anyDateInWeek);
  const sun = addDaysToIso(mon, 6);
  let total = 0;
  for (const s of shifts) {
    if (omitShiftId && s.id === omitShiftId) continue;
    if (s.shiftKind === "project_task" || !s.workerId || s.workerId !== workerId) continue;
    if (s.date < mon || s.date > sun) continue;
    if (s.eventType === "vacation" || s.eventType === "sick") continue;
    total += shiftLengthHours(s);
  }
  return total;
}

export function ScheduleApp() {
  const session = readSession();
  const currentUserId = session?.sub ?? null;
  const canPublishSchedule = sessionHasAnyRole(session, "manager", "supervisor", "company_admin", "system_admin");

  const scheduleMod = useModuleSettings("schedule");
  const scheduleFlags = scheduleMod.settings as { allowShiftOverrides?: boolean };
  const shiftDragEnabled = scheduleFlags.allowShiftOverrides !== false;
  // Worker → calendar drag creates a new shift; keep enabled even when shift overrides are locked down.
  const workerDragEnabled = true;

  const [cursor, setCursor] = useState(() => {
    const n = getServerDate();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [view, setView] = useState<View>("calendar");
  const [calendarScale, setCalendarScale] = useState<CalendarScale>("month");
  const [focusDate, setFocusDate] = useState(() => formatLocalDate(getServerDate()));
  const [contentFilter, setContentFilter] = useState<ScheduleContentFilter>("combined");
  const [shiftDefinitions, setShiftDefinitions] = useState<{ id: string; code: string; name?: string | null }[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [dragSession, setDragSession] = useState<ScheduleDragSession | null>(null);
  const [trashHovering, setTrashHovering] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [scheduleProjects, setScheduleProjects] = useState<ProjectRow[] | null>(null);
  const [showProjectOverlay, setShowProjectOverlay] = useState(true);
  const schedulePath = usePathname() ?? "";
  const [shiftModal, setShiftModal] = useState<{
    shift: Shift | null;
    defaultDate: string;
  } | null>(null);

  const shifts = useScheduleStore((s) => s.shifts);
  const workers = useScheduleStore((s) => s.workers);
  const zones = useScheduleStore((s) => s.zones);
  const roles = useScheduleStore((s) => s.roles);
  const shiftTypes = useScheduleStore((s) => s.shiftTypes);
  const settings = useScheduleStore((s) => s.settings);
  const pendingRequests = useScheduleStore((s) => s.pendingRequests);
  const timeOffBlocks = useScheduleStore((s) => s.timeOffBlocks);
  const addShift = useScheduleStore((s) => s.addShift);
  const updateShift = useScheduleStore((s) => s.updateShift);
  const deleteShift = useScheduleStore((s) => s.deleteShift);
  const addTimeOffBlock = useScheduleStore((s) => s.addTimeOffBlock);
  const applyPulseScheduleSnapshot = useScheduleStore((s) => s.applyPulseScheduleSnapshot);

  const [hydrated, setHydrated] = useState(false);
  const [scheduleModuleBlocked, setScheduleModuleBlocked] = useState(false);
  useEffect(() => {
    const unsub = useScheduleStore.persist.onFinishHydration(() => setHydrated(true));
    if (useScheduleStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      void useScheduleStore.persist.rehydrate();
    }
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated || !isApiMode()) return;
    let cancelled = false;
    (async () => {
      try {
        await patchOnboarding({ step: "view_schedule", completed: true });
        await refreshPulseUserFromServer();
        if (!cancelled) emitOnboardingMaybeUpdated();
      } catch {
        /* offline / not in worker flow / 403 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !isApiMode() || !schedulePath.includes("schedule")) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await listProjects();
        if (!cancelled) setScheduleProjects(data);
      } catch {
        if (!cancelled) setScheduleProjects([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, schedulePath]);

  const reloadPulseSchedule = useCallback(async () => {
    if (!isApiMode()) return;
    let from: Date;
    let to: Date;
    if (calendarScale === "month") {
      const first = new Date(cursor.y, cursor.m, 1);
      const last = new Date(cursor.y, cursor.m + 1, 0);
      from = new Date(first);
      from.setHours(0, 0, 0, 0);
      to = new Date(last);
      to.setHours(23, 59, 59, 999);
    } else if (calendarScale === "week") {
      const dates = weekDatesFromSunday(focusDate);
      from = parseLocalDate(dates[0]);
      from.setHours(0, 0, 0, 0);
      to = parseLocalDate(dates[6]);
      to.setHours(23, 59, 59, 999);
    } else {
      from = parseLocalDate(focusDate);
      from.setHours(0, 0, 0, 0);
      to = new Date(from);
      to.setHours(23, 59, 59, 999);
    }
    const [w, z, defs] = await Promise.all([
      apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers"),
      apiFetch<PulseZoneApi[]>("/api/v1/pulse/schedule-facilities"),
      apiFetch<{ id: string; code: string; name?: string | null }[]>("/api/v1/pulse/schedule/shift-definitions"),
    ]);
    let sh: PulseShiftApi[] = [];
    try {
      sh = await apiFetch<PulseShiftApi[]>(
        `/api/v1/pulse/schedule/shifts?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
      );
      setScheduleModuleBlocked(false);
    } catch (err) {
      const e = err as { status?: number; body?: unknown };
      if (e.status === 403) {
        const body = e.body as { detail?: string; feature?: string } | undefined;
        if (body?.detail === "feature_disabled" && body?.feature === "schedule") {
          setScheduleModuleBlocked(true);
          return;
        }
        throw err;
      }
      throw err;
    }
    const zonesMapped = pulseZonesToSchedule(z);
    const fallbackZ = zonesMapped[0]?.id ?? "";
    const workersMapped = pulseWorkersToSchedule(w);
    const shiftsMapped = pulseShiftsToSchedule(sh, fallbackZ);
    applyPulseScheduleSnapshot(workersMapped, zonesMapped, shiftsMapped);
    setShiftDefinitions(defs);
  }, [applyPulseScheduleSnapshot, calendarScale, cursor.m, cursor.y, focusDate]);

  const scheduleFacilitySettingsKey = useMemo(() => {
    const s = scheduleMod.settings as { facilityCount?: number; facilityLabels?: string[] };
    return `${s.facilityCount ?? ""}:${JSON.stringify(s.facilityLabels ?? [])}`;
  }, [scheduleMod.settings]);

  useEffect(() => {
    if (!hydrated || !isApiMode()) return;
    void reloadPulseSchedule();
  }, [hydrated, reloadPulseSchedule, scheduleFacilitySettingsKey]);

  const hasPendingServerSave = useMemo(() => {
    if (!isApiMode()) return false;
    return shifts.some((s) => {
      if (s.autoGenerated || isEphemeralScheduleShiftId(s.id) || s.shiftKind === "project_task") return false;
      if (!s.workerId || s.eventType !== "work") return false;
      if (!isPulseApiShiftId(s.id)) return true;
      return Boolean(s.uiFlags?.isUpdated);
    });
  }, [shifts]);

  function formatScheduleSaveError(e: unknown): string {
    if (e && typeof e === "object" && "body" in e) {
      const body = (e as { body: unknown }).body;
      if (body && typeof body === "object" && body !== null && "detail" in body) {
        const d = (body as { detail: unknown }).detail;
        if (typeof d === "string") return d;
        if (d && typeof d === "object" && d !== null && "errors" in d) {
          const errs = (d as { errors: unknown }).errors;
          if (Array.isArray(errs)) return errs.map(String).join("\n");
        }
        try {
          return JSON.stringify(d);
        } catch {
          /* fall through */
        }
      }
    }
    return e instanceof Error ? e.message : "Could not save schedule.";
  }

  const saveScheduleToServer = useCallback(async () => {
    if (!isApiMode()) {
      window.alert("Connect to the Pulse API to sync shifts to the server. Demo data is kept in this browser automatically.");
      return;
    }
    const raw = useScheduleStore.getState().shifts;
    const toUpdate = raw.filter(
      (s) =>
        !s.autoGenerated &&
        !isEphemeralScheduleShiftId(s.id) &&
        isPulseApiShiftId(s.id) &&
        s.uiFlags?.isUpdated &&
        s.shiftKind !== "project_task" &&
        s.workerId &&
        s.eventType === "work",
    );
    const toCreate = raw.filter(
      (s) =>
        !s.autoGenerated &&
        !isEphemeralScheduleShiftId(s.id) &&
        !isPulseApiShiftId(s.id) &&
        s.shiftKind !== "project_task" &&
        s.workerId &&
        s.eventType === "work",
    );
    if (toUpdate.length === 0 && toCreate.length === 0) {
      window.alert("Nothing new to save — shift edits are already on the server, or add a shift first.");
      return;
    }
    setSaveBusy(true);
    try {
      for (const s of toUpdate) {
        await apiFetch(`/api/v1/pulse/schedule/shifts/${s.id}`, {
          method: "PATCH",
          json: {
            assigned_user_id: s.workerId,
            starts_at: localDateTimeToIso(s.date, s.startTime),
            ends_at: localDateTimeToIso(s.date, s.endTime),
            facility_id: s.zoneId || null,
            shift_type: s.shiftType,
            requires_supervisor: !!s.requires_supervisor,
            requires_ticketed: false,
          },
        });
      }
      for (const s of toCreate) {
        await apiFetch("/api/v1/pulse/schedule/shifts", {
          method: "POST",
          json: {
            assigned_user_id: s.workerId,
            starts_at: localDateTimeToIso(s.date, s.startTime),
            ends_at: localDateTimeToIso(s.date, s.endTime),
            facility_id: s.zoneId || null,
            shift_type: s.shiftType,
            requires_supervisor: !!s.requires_supervisor,
            requires_ticketed: false,
          },
        });
      }
      await reloadPulseSchedule();
      setDeleteToast(`Saved ${toCreate.length + toUpdate.length} shift${toCreate.length + toUpdate.length === 1 ? "" : "s"} to the server.`);
    } catch (e) {
      window.alert(formatScheduleSaveError(e));
    } finally {
      setSaveBusy(false);
    }
  }, [reloadPulseSchedule]);

  const visibleDatesForScheduleMerge = useMemo(() => {
    if (calendarScale === "month") return monthGrid(cursor.y, cursor.m).map((c) => c.date);
    if (calendarScale === "week") return weekDatesFromSunday(focusDate);
    return [focusDate];
  }, [calendarScale, cursor.y, cursor.m, focusDate]);

  const shiftsForView = useMemo(() => {
    const zid = zones[0]?.id ?? shifts[0]?.zoneId ?? "";
    if (!zid) return shifts;
    return mergeEphemeralSchedule(shifts, workers, visibleDatesForScheduleMerge, timeOffBlocks, zid);
  }, [shifts, workers, visibleDatesForScheduleMerge, timeOffBlocks, zones]);

  const myShifts = useMemo(() => {
    if (!currentUserId) return [];
    return shifts
      .filter(
        (s) =>
          s.workerId === currentUserId &&
          s.eventType !== "vacation" &&
          s.eventType !== "sick" &&
          !s.autoGenerated,
      )
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  }, [shifts, currentUserId]);

  const displayShifts = useMemo(() => {
    const base = shiftsForView;
    let v: typeof base;
    if (contentFilter === "workers") {
      v = base.filter((s) => s.shiftKind !== "project_task");
    } else if (contentFilter === "projects") {
      v = base.filter((s) => s.shiftKind === "project_task");
    } else {
      v = base;
    }
    // Assigned project tasks are shown under Assignments, not on the main shift grid.
    return v.filter((s) => !(s.shiftKind === "project_task" && s.workerId));
  }, [shiftsForView, contentFilter]);

  const workerHighlightMap = useMemo(() => {
    if (dragSession?.kind !== "worker") return null;
    const w = workers.find((x) => x.id === dragSession.workerId);
    if (!w) return null;
    const dates =
      calendarScale === "month"
        ? monthGrid(cursor.y, cursor.m).map((c) => c.date)
        : calendarScale === "week"
          ? weekDatesFromSunday(focusDate)
          : [focusDate];
    return buildWorkerDragHighlightMap(w, dates, shiftsForView, settings, timeOffBlocks);
  }, [
    dragSession,
    workers,
    shiftsForView,
    settings,
    timeOffBlocks,
    calendarScale,
    cursor.y,
    cursor.m,
    focusDate,
  ]);

  const weekDates = useMemo(() => weekDatesFromSunday(focusDate), [focusDate]);

  const metricsMonth = useMemo(() => {
    if (calendarScale === "month") {
      return { y: cursor.y, m: cursor.m };
    }
    const d = parseLocalDate(focusDate);
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [calendarScale, cursor.y, cursor.m, focusDate]);

  const defaultDate = useMemo(() => {
    if (calendarScale === "day") return focusDate;
    const today = getServerDate();
    if (today.getFullYear() === cursor.y && today.getMonth() === cursor.m) {
      return formatLocalDate(today);
    }
    return formatLocalDate(new Date(cursor.y, cursor.m, 1));
  }, [calendarScale, focusDate, cursor.y, cursor.m]);

  const alerts = useMemo(
    () => {
      const base = computeAlerts(shiftsForView, metricsMonth.y, metricsMonth.m, settings);
      const dates = monthGrid(metricsMonth.y, metricsMonth.m)
        .filter((c) => c.inMonth)
        .map((c) => c.date);
      const v = evaluateCoverageRules(
        (scheduleMod.settings as { coverageRules?: unknown }).coverageRules,
        dates,
        shiftsForView,
        workers,
      );
      return {
        ...base,
        coverageCritical: v.filter((x) => x.severity === "critical").length,
        coverageWarnings: v.filter((x) => x.severity === "warning").length,
      };
    },
    [shiftsForView, metricsMonth.y, metricsMonth.m, settings, scheduleMod.settings, workers],
  );

  const summary = useMemo(
    () =>
      computeWorkforceSummary(workers, shiftsForView, metricsMonth.y, metricsMonth.m, settings, pendingRequests),
    [workers, shiftsForView, metricsMonth.y, metricsMonth.m, settings, pendingRequests],
  );

  function openAdd(dateIso: string) {
    setShiftModal({ shift: null, defaultDate: dateIso });
  }

  function openEdit(s: Shift) {
    setShiftModal({ shift: s, defaultDate: s.date });
  }

  const handlePublish = useCallback(async () => {
    if (!visibleDatesForScheduleMerge.length) return;
    try {
      const url = "/api/v1/pulse/schedule/publish";
      await apiFetch(url, {
        method: "POST",
        body: JSON.stringify({
          period_start: visibleDatesForScheduleMerge[0],
          period_end: visibleDatesForScheduleMerge[visibleDatesForScheduleMerge.length - 1],
          notify_workers: true,
        }),
      });
      // TODO: show a success toast when toast system is available
    } catch (e) {
      console.error("Publish failed", e);
    }
  }, [visibleDatesForScheduleMerge]);

  const certsOf = (d: ShiftDraft) => (d.required_certifications ?? []).filter(Boolean);

  async function saveShift(draft: ShiftDraft) {
    const weeklyCap = Number(scheduleMod.settings.enforceMaxHours) || 0;
    if (weeklyCap > 0 && draft.workerId) {
      const projected =
        weeklyAssignedHours(shiftsForView, draft.workerId, draft.date, draft.id ?? undefined) +
        shiftLengthHours(draft);
      if (projected > weeklyCap + 1e-6) {
        window.alert(
          `This assignment would exceed the organization limit of ${weeklyCap} hours per week (${projected.toFixed(1)}h scheduled). Adjust times or turn off the cap in Schedule settings.`,
        );
        return;
      }
    }
    const certs = certsOf(draft);
    const req = {
      workerId: draft.workerId,
      date: draft.date,
      startTime: draft.startTime,
      endTime: draft.endTime,
      shiftType: draft.shiftType,
      eventType: draft.eventType ?? "work",
      role: draft.role,
      zoneId: draft.zoneId,
      required_certifications: certs.length ? certs : undefined,
      accepts_any_certification:
        certs.length > 0 && draft.accepts_any_certification === true ? true : undefined,
      requires_supervisor: !!draft.requires_supervisor,
      minimum_workers: draft.minimum_workers,
    };
    if (isApiMode() && draft.id && isPulseApiShiftId(draft.id) && draft.workerId) {
      try {
        await apiFetch(`/api/v1/pulse/schedule/shifts/${draft.id}`, {
          method: "PATCH",
          json: {
            assigned_user_id: draft.workerId,
            starts_at: localDateTimeToIso(draft.date, draft.startTime),
            ends_at: localDateTimeToIso(draft.date, draft.endTime),
            facility_id: draft.zoneId || null,
            shift_type: draft.shiftType,
            requires_supervisor: !!draft.requires_supervisor,
            requires_ticketed: false,
          },
        });
        await reloadPulseSchedule();
      } catch {
        /* keep local fallthrough */
      }
      setShiftModal(null);
      return;
    }
    if (draft.id) {
      updateShift(draft.id, {
        ...req,
        uiFlags: { isUpdated: true },
      });
    } else {
      addShift({
        ...req,
        uiFlags: { isNew: true },
      });
    }
    setShiftModal(null);
  }

  const handleShiftMove = useCallback(
    async (shiftId: string, targetDate: string, mode: "move" | "duplicate") => {
      if (!shiftDragEnabled) return;
      const sh = shiftsForView.find((s) => s.id === shiftId);
      if (!sh) return;
      if (sh.autoGenerated) return;
      const weeklyCap = Number(scheduleMod.settings.enforceMaxHours) || 0;
      if (weeklyCap > 0 && sh.workerId && sh.eventType !== "vacation" && sh.eventType !== "sick") {
        const withShift =
          mode === "move"
            ? weeklyAssignedHours(shiftsForView, sh.workerId, targetDate, sh.id) + shiftLengthHours(sh)
            : weeklyAssignedHours(shiftsForView, sh.workerId, targetDate) + shiftLengthHours(sh);
        if (withShift > weeklyCap + 1e-6) {
          window.alert(
            `Moving or copying this shift would exceed the ${weeklyCap}h weekly limit (${withShift.toFixed(1)}h). Change schedule settings or adjust shifts.`,
          );
          return;
        }
      }
      if (mode === "duplicate" && sh.shiftKind === "project_task") {
        return;
      }
      if (isApiMode() && isPulseApiShiftId(shiftId) && sh.workerId && mode === "move") {
        if (sh.date === targetDate) return;
        try {
          await apiFetch(`/api/v1/pulse/schedule/shifts/${shiftId}`, {
            method: "PATCH",
            json: {
              starts_at: localDateTimeToIso(targetDate, sh.startTime),
              ends_at: localDateTimeToIso(targetDate, sh.endTime),
            },
          });
          await reloadPulseSchedule();
        } catch {
          updateShift(shiftId, { date: targetDate, uiFlags: { ...sh.uiFlags, isUpdated: true } });
        }
        return;
      }
      if (mode === "move") {
        if (sh.date !== targetDate) {
          updateShift(shiftId, { date: targetDate, uiFlags: { ...sh.uiFlags, isUpdated: true } });
        }
        return;
      }
      const { id: _id, ...rest } = sh;
      void _id;
      addShift({
        ...rest,
        date: targetDate,
        uiFlags: { isNew: true },
      });
    },
    [addShift, reloadPulseSchedule, scheduleMod.settings.enforceMaxHours, shiftDragEnabled, shiftsForView, updateShift],
  );

  const handleWorkerDrop = useCallback(
    (workerId: string, targetDate: string) => {
      const w = workers.find((x) => x.id === workerId);
      if (!w) return;
      const ev = evaluateWorkerDrop(w, targetDate, shiftsForView, settings, timeOffBlocks);
      if (!ev.ok) return;
      const dow = weekdayKeyFromIso(targetDate);
      const rule = w.recurringShifts?.find((r) => normalizeWeekdayKey(String(r.dayOfWeek)) === dow);
      const start = rule?.start ?? settings.workDayStart;
      const end = rule?.end ?? settings.workDayEnd;
      const zoneId = zones[0]?.id ?? shifts[0]?.zoneId ?? "";
      if (!zoneId) return;
      addShift({
        workerId: w.id,
        date: targetDate,
        startTime: start,
        endTime: end,
        shiftType: inferShiftTypeFromStart(start),
        eventType: "work",
        role: (rule?.role ?? w.role) as Shift["role"],
        zoneId,
        shiftKind: "workforce",
        required_certifications: rule?.requiredCertifications?.filter(Boolean),
        uiFlags: { isNew: true },
      });
    },
    [addShift, shifts, shiftsForView, settings, timeOffBlocks, workers, zones],
  );

  function prevMonth() {
    setCursor((c) => {
      const d = new Date(c.y, c.m - 1, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function nextMonth() {
    setCursor((c) => {
      const d = new Date(c.y, c.m + 1, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  function goToday() {
    const td = getServerDate();
    setFocusDate(formatLocalDate(td));
    setCursor({ y: td.getFullYear(), m: td.getMonth() });
  }

  const projectLegendItems: ScheduleProjectLegendItem[] | null = useMemo(() => {
    if (!scheduleProjects || scheduleProjects.length === 0) return null;
    const active = scheduleProjects
      .filter((p) => p.status !== "completed")
      .sort((a, b) => a.name.localeCompare(b.name));
    if (active.length === 0) return null;
    return active.map((p) => ({
      id: p.id,
      name: p.name,
      tintClass: getOrAssignProjectTintClass(p.id),
    }));
  }, [scheduleProjects]);

  const projectBarItems: ProjectBarItem[] | null = useMemo(() => {
    if (!scheduleProjects || scheduleProjects.length === 0) return null;
    const active = scheduleProjects
      .filter((p) => p.status !== "completed")
      .sort((a, b) => a.name.localeCompare(b.name));
    if (active.length === 0) return null;
    return active.map((p) => ({
      id: p.id,
      name: p.name,
      start_date: p.start_date,
      end_date: p.end_date,
      tintClass: getOrAssignProjectTintClass(p.id),
    }));
  }, [scheduleProjects]);

  const dayProjectBar = useMemo(() => {
    if (calendarScale !== "day" || !projectBarItems) return null;
    return projectBarItems
      .filter((p) => focusDate >= p.start_date && focusDate <= p.end_date)
      .map((p) => ({ id: p.id, name: p.name, tintClass: p.tintClass }));
  }, [calendarScale, focusDate, projectBarItems]);

  const dayDisplayShifts = useMemo(
    () => displayShifts.filter((s) => s.date === focusDate),
    [displayShifts, focusDate],
  );

  const dayAllShifts = useMemo(() => shiftsForView.filter((s) => s.date === focusDate), [shiftsForView, focusDate]);

  const scheduleDragLock = dragSession !== null;
  const calendarDropsDisabled = trashHovering;

  useEffect(() => {
    if (scheduleDragLock) {
      document.body.classList.add("schedule-shift-dragging");
    } else {
      document.body.classList.remove("schedule-shift-dragging");
    }
    return () => document.body.classList.remove("schedule-shift-dragging");
  }, [scheduleDragLock]);

  useEffect(() => {
    if (!deleteToast) return;
    const t = window.setTimeout(() => setDeleteToast(null), 2600);
    return () => window.clearTimeout(t);
  }, [deleteToast]);

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Loading schedule…
      </div>
    );
  }

  if (scheduleModuleBlocked && isApiMode()) {
    return (
      <div className="flex min-h-[min(70vh,520px)] flex-col">
        <div className="mx-auto w-full max-w-2xl py-6">
          <Card padding="md">
            <h1 className="font-headline text-xl font-bold text-gray-900 dark:text-white">Schedule</h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              The schedule module is not enabled for your organization. A system administrator can turn on the{" "}
              <span className="font-semibold text-gray-900 dark:text-gray-100">schedule</span> feature for your company in System admin →
              Companies.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex-1 pb-2">
        <div className={scheduleDragLock ? "pointer-events-none" : ""}>
          <PageHeader
            title="Schedule"
            description="Plan shifts by facility and coverage across your operation (facilities are configured under Schedule organization settings)."
            icon={CalendarDays}
            actions={
              <>
                <SettingsGear module="schedule" />
                <nav
                  className="flex rounded-md border border-pulseShell-border bg-pulseShell-surface p-1 shadow-[var(--pulse-shell-shadow)]"
                  aria-label="Schedule views"
                >
                  {(
                    [
                      ["calendar", "Calendar", CalendarDays],
                      ["my-shifts", "My Shifts", User],
                      ["personnel", "Personnel", Users],
                      ["reports", "Reports", BarChart2],
                    ] as const
                  ).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setView(key);
                        if (key !== "calendar") setCalendarScale("month");
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                        view === key
                          ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)] dark:ring-sky-400/30"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
                      }`}
                    >
                      <Icon className="h-4 w-4 opacity-90" />
                      {label}
                    </button>
                  ))}
                </nav>
                {isApiMode() ? (
                  <button
                    type="button"
                    disabled={saveBusy || !hasPendingServerSave}
                    title={
                      hasPendingServerSave
                        ? "Write unsaved shifts to the server (new drops and offline edits)"
                        : "No unsaved shifts — drag a worker to add a shift, then save"
                    }
                    onClick={() => void saveScheduleToServer()}
                    className="inline-flex items-center gap-2 rounded-md border border-pulseShell-border bg-pulseShell-surface px-4 py-2 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-ds-interactive-hover disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-100"
                  >
                    <Save className="h-4 w-4" />
                    {saveBusy ? "Saving…" : "Save"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setTimeOffOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-pulseShell-border bg-pulseShell-surface px-4 py-2 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:text-gray-100"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Time off
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md border border-pulseShell-border bg-pulseShell-surface px-4 py-2 text-sm font-semibold text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:text-gray-100"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </button>
              </>
            }
          />
        </div>

        {view === "calendar" ? (
          <div
            className={`mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center ${scheduleDragLock ? "pointer-events-none" : ""}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">View</span>
              <nav
                className="flex rounded-md border border-pulseShell-border bg-pulseShell-surface p-1 shadow-[var(--pulse-shell-shadow)]"
                aria-label="Calendar scale"
              >
                {(
                  [
                    ["month", "Month", LayoutGrid],
                    ["week", "Week", CalendarRange],
                    ["day", "Day", CalendarDays],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCalendarScale(key)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      calendarScale === key
                        ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)] dark:ring-sky-400/30"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 opacity-90" />
                    {label}
                  </button>
                ))}
              </nav>
              <button
                type="button"
                onClick={() => setShowProjectOverlay((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  showProjectOverlay
                    ? "border-ds-accent/40 bg-ds-accent/10 text-ds-accent"
                    : "border-ds-border bg-ds-primary text-ds-muted hover:text-ds-foreground"
                }`}
                title={showProjectOverlay ? "Hide project overlay" : "Show project overlay"}
              >
                Projects
              </button>
              {canPublishSchedule && isApiMode() ? (
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-ds-accent px-3 py-1.5 text-xs font-bold text-ds-accent-foreground hover:bg-ds-accent/90"
                >
                  Publish schedule
                </button>
              ) : null}
            </div>
            <div className="hidden h-6 w-px bg-pulseShell-border sm:block" aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Show</span>
              <nav
                id="schedule-toggle"
                className="flex rounded-md border border-pulseShell-border bg-pulseShell-surface p-1 shadow-[var(--pulse-shell-shadow)]"
                aria-label="Schedule content filter"
              >
                {(
                  [
                    ["workers", "Workers"],
                    ["projects", "Projects"],
                    ["combined", "Combined"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setContentFilter(key)}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      contentFilter === key
                        ? "bg-[var(--pulse-segment-active-bg)] text-[var(--pulse-segment-active-fg)] shadow-sm ring-1 ring-[color-mix(in_srgb,var(--ds-success)_28%,transparent)] dark:ring-sky-400/30"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        ) : null}

        <div className={`mt-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}>
          <ScheduleAlertsBanner alerts={alerts} />
        </div>

        <div className="relative mt-5">
          {scheduleDragLock ? (
            <div
              className="pointer-events-none fixed inset-0 z-[115] bg-[color-mix(in_srgb,var(--ds-text-primary)_6%,transparent)] dark:bg-ds-bg/35"
              aria-hidden
            />
          ) : null}
          {view === "calendar" ? (
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
              <div className="flex w-full shrink-0 flex-col gap-4 xl:order-first xl:w-72">
                <ScheduleWorkerPanel
                  workers={workers}
                  rosterDragEnabled={workerDragEnabled}
                  onDragSessionStart={setDragSession}
                  onDragSessionEnd={() => {
                    setDragSession(null);
                    setTrashHovering(false);
                  }}
                />
                <ScheduleLegendPanel
                  shiftTypes={shiftTypes}
                  shifts={displayShifts}
                  workers={workers}
                  shiftDefinitions={shiftDefinitions}
                  contentFilter={contentFilter}
                  projectLegendItems={projectLegendItems}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                {calendarScale === "day" ? (
                  <div className="space-y-3">
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-pulseShell-border bg-pulseShell-surface px-3 py-2 shadow-[var(--pulse-shell-shadow)] ${scheduleDragLock ? "pointer-events-none" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:text-gray-100"
                          onClick={() => setFocusDate((p) => addDaysToIso(p, -1))}
                          aria-label="Previous day"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated px-3 py-2 text-xs font-semibold text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:text-gray-100"
                          onClick={goToday}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-pulseShell-border bg-pulseShell-elevated p-2 text-ds-foreground shadow-sm hover:bg-ds-interactive-hover dark:text-gray-100"
                          onClick={() => setFocusDate((p) => addDaysToIso(p, 1))}
                          aria-label="Next day"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <ScheduleDayView
                      date={focusDate}
                      onClose={() => setCalendarScale("month")}
                      shifts={dayDisplayShifts}
                      contextShifts={shiftsForView}
                      dayShiftsAll={dayAllShifts}
                      workers={workers}
                      zones={zones}
                      roles={roles}
                      shiftTypes={shiftTypes}
                      settings={settings}
                      timeOffBlocks={timeOffBlocks}
                      onSelectShift={openEdit}
                      onAddForDate={(iso) => openAdd(iso)}
                      scheduleDragLock={scheduleDragLock}
                      dragSession={dragSession}
                      calendarDropsDisabled={calendarDropsDisabled}
                      shiftDragEnabled={shiftDragEnabled}
                      workerDayHighlight={workerHighlightMap?.[focusDate] ?? null}
                      onWorkerDrop={(workerId) => handleWorkerDrop(workerId, focusDate)}
                      onShiftDragSessionStart={setDragSession}
                      onShiftDragSessionEnd={() => {
                        setDragSession(null);
                        setTrashHovering(false);
                      }}
                      nightAssignmentsEnabled={
                        (scheduleMod.settings as { enableNightAssignments?: boolean }).enableNightAssignments !== false
                      }
                      dayProjectBar={dayProjectBar}
                    />
                  </div>
                ) : null}
                {calendarScale === "week" ? (
                  <ScheduleWeekView
                    weekDates={weekDates}
                    onPrevWeek={() => setFocusDate((p) => addDaysToIso(p, -7))}
                    onNextWeek={() => setFocusDate((p) => addDaysToIso(p, 7))}
                    onToday={goToday}
                    shifts={displayShifts}
                    workers={workers}
                    zones={zones}
                    roles={roles}
                    shiftTypes={shiftTypes}
                    settings={settings}
                    timeOffBlocks={timeOffBlocks}
                    onSelectShift={openEdit}
                    onAddForDate={openAdd}
                    onShiftMove={handleShiftMove}
                    onWorkerDrop={handleWorkerDrop}
                    onOpenDay={(iso) => {
                      setFocusDate(iso);
                      setCalendarScale("day");
                    }}
                    projectBarItems={showProjectOverlay ? projectBarItems : null}
                    scheduleDragLock={scheduleDragLock}
                    dragSession={dragSession}
                    calendarDropsDisabled={calendarDropsDisabled}
                    shiftDragEnabled={shiftDragEnabled}
                    workerHighlightByDate={workerHighlightMap}
                    onShiftDragSessionStart={setDragSession}
                    onShiftDragSessionEnd={() => {
                      setDragSession(null);
                      setTrashHovering(false);
                    }}
                  />
                ) : null}
                {calendarScale === "month" ? (
                  <ScheduleCalendarGrid
                    year={cursor.y}
                    monthIndex={cursor.m}
                    onPrevMonth={prevMonth}
                    onNextMonth={nextMonth}
                    shifts={displayShifts}
                    workers={workers}
                    zones={zones}
                    roles={roles}
                    shiftTypes={shiftTypes}
                    settings={settings}
                    timeOffBlocks={timeOffBlocks}
                    onSelectShift={openEdit}
                    onAddForDate={openAdd}
                    onShiftMove={handleShiftMove}
                    onWorkerDrop={handleWorkerDrop}
                    onOpenDay={(iso) => {
                      setFocusDate(iso);
                      setCalendarScale("day");
                    }}
                    projectBarItems={showProjectOverlay ? projectBarItems : null}
                    scheduleDragLock={scheduleDragLock}
                    dragSession={dragSession}
                    calendarDropsDisabled={calendarDropsDisabled}
                    shiftDragEnabled={shiftDragEnabled}
                    workerHighlightByDate={workerHighlightMap}
                    onShiftDragSessionStart={setDragSession}
                    onShiftDragSessionEnd={() => {
                      setDragSession(null);
                      setTrashHovering(false);
                    }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          {view === "my-shifts" ? (
            <ScheduleMyShiftsView
              shifts={myShifts}
              workers={workers}
              currentUserId={currentUserId}
              settings={settings}
              onSelectShift={openEdit}
            />
          ) : null}
          {view === "personnel" ? (
            <SchedulePersonnel
              workers={workers}
              shifts={shifts}
              roles={roles}
              year={metricsMonth.y}
              monthIndex={metricsMonth.m}
              scheduleDragLocked={scheduleDragLock}
            />
          ) : null}
          {view === "reports" ? <ScheduleReports /> : null}
        </div>
      </div>

      <div className={scheduleDragLock ? "pointer-events-none" : ""}>
        <ScheduleWorkforceBar summary={summary} />
      </div>

      <ShiftEditModal
        open={shiftModal !== null}
        shift={shiftModal?.shift ?? null}
        defaultDate={shiftModal?.defaultDate ?? defaultDate}
        workers={workers}
        zones={zones}
        roles={roles}
        shiftTypes={shiftTypes}
        settings={settings}
        allShifts={shiftsForView}
        onClose={() => setShiftModal(null)}
        onSave={saveShift}
        onDelete={
          shiftModal?.shift
            ? async (id) => {
                const removed = shiftsForView.find((s) => s.id === id);
                const remaining = shiftsForView.filter((s) => s.id !== id);
                if (isApiMode() && isPulseApiShiftId(id)) {
                  try {
                    await apiFetch(`/api/v1/pulse/schedule/shifts/${id}`, { method: "DELETE" });
                    await reloadPulseSchedule();
                  } catch {
                    deleteShift(id);
                  }
                } else {
                  deleteShift(id);
                }
                setShiftModal(null);
                const tip =
                  removed && !removed.autoGenerated
                    ? suggestReplacementLabel(removed, workers, remaining, settings, timeOffBlocks)
                    : null;
                setDeleteToast(tip ? `Shift deleted. ${tip}` : "Shift deleted");
              }
            : undefined
        }
      />

      <ScheduleSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ScheduleTrashDropZone
        active={scheduleDragLock && shiftDragEnabled && dragSession?.kind === "shift"}
        isDuplicateDrag={dragSession?.kind === "shift" && dragSession.duplicate}
        onHoverChange={setTrashHovering}
        onDropTrash={async (id) => {
          if (isApiMode() && isPulseApiShiftId(id)) {
            try {
              await apiFetch(`/api/v1/pulse/schedule/shifts/${id}`, { method: "DELETE" });
              await reloadPulseSchedule();
            } catch {
              deleteShift(id);
            }
          } else {
            deleteShift(id);
          }
          setDragSession(null);
          setTrashHovering(false);
          const removed = shiftsForView.find((s) => s.id === id);
          const remaining = shiftsForView.filter((s) => s.id !== id);
          const tip =
            removed && !removed.autoGenerated
              ? suggestReplacementLabel(removed, workers, remaining, settings, timeOffBlocks)
              : null;
          setDeleteToast(tip ? `Shift deleted. ${tip}` : "Shift deleted");
        }}
      />

      {deleteToast ? (
        <div
          className="pointer-events-none fixed bottom-24 left-1/2 z-[150] -translate-x-1/2 rounded-md border border-pulseShell-border bg-pulseShell-elevated px-4 py-2.5 text-center text-sm font-medium text-ds-foreground shadow-lg dark:text-ds-foreground sm:bottom-28"
          role="status"
        >
          {deleteToast}
        </div>
      ) : null}

      <TimeOffRequestModal
        open={timeOffOpen}
        workers={workers}
        onClose={() => setTimeOffOpen(false)}
        onSubmit={(p) => addTimeOffBlock(p)}
      />
    </div>
  );
}
