"use client";

import {
  BarChart2,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Settings,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { apiFetch, isApiMode, refreshPulseUserFromServer } from "@/lib/api";
import { getServerDate } from "@/lib/serverTime";
import { emitOnboardingMaybeUpdated } from "@/lib/onboarding-events";
import { patchOnboarding } from "@/lib/onboardingService";
import {
  addDaysToIso,
  formatLocalDate,
  monthGrid,
  parseLocalDate,
  weekDatesFromSunday,
} from "@/lib/schedule/calendar";
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
import type { Shift } from "@/lib/schedule/types";
import { ScheduleAlertsBanner } from "./ScheduleAlertsBanner";
import { ScheduleCalendarGrid } from "./ScheduleCalendarGrid";
import { ScheduleDayView } from "./ScheduleDayView";
import { ScheduleLegendPanel } from "./ScheduleLegendPanel";
import { SchedulePersonnel } from "./SchedulePersonnel";
import { ScheduleReports } from "./ScheduleReports";
import { ScheduleSettingsModal } from "./ScheduleSettingsModal";
import { ScheduleTrashDropZone } from "./ScheduleTrashDropZone";
import { Card } from "@/components/pulse/Card";
import { ScheduleWeekView } from "./ScheduleWeekView";
import { ScheduleWorkforceBar } from "./ScheduleWorkforceBar";
import type { ShiftDraft } from "./ShiftEditModal";
import { ShiftEditModal } from "./ShiftEditModal";
import { TimeOffRequestModal } from "./TimeOffRequestModal";

type View = "calendar" | "personnel" | "reports";
type CalendarScale = "month" | "week" | "day";
type ScheduleContentFilter = "workers" | "projects" | "combined";

export function ScheduleApp() {
  const [cursor, setCursor] = useState(() => {
    const n = getServerDate();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [view, setView] = useState<View>("calendar");
  const [calendarScale, setCalendarScale] = useState<CalendarScale>("month");
  const [focusDate, setFocusDate] = useState(() => formatLocalDate(getServerDate()));
  const [contentFilter, setContentFilter] = useState<ScheduleContentFilter>("combined");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [dragSession, setDragSession] = useState<{ shiftId: string; duplicate: boolean } | null>(null);
  const [trashHovering, setTrashHovering] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
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
    const [w, z] = await Promise.all([
      apiFetch<PulseWorkerApi[]>("/api/v1/pulse/workers"),
      apiFetch<PulseZoneApi[]>("/api/v1/pulse/zones"),
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
  }, [applyPulseScheduleSnapshot, calendarScale, cursor.m, cursor.y, focusDate]);

  useEffect(() => {
    if (!hydrated || !isApiMode()) return;
    void reloadPulseSchedule();
  }, [hydrated, reloadPulseSchedule]);

  const displayShifts = useMemo(() => {
    if (contentFilter === "workers") {
      return shifts.filter((s) => s.shiftKind !== "project_task");
    }
    if (contentFilter === "projects") {
      return shifts.filter((s) => s.shiftKind === "project_task");
    }
    return shifts;
  }, [shifts, contentFilter]);

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
    () => computeAlerts(shifts, metricsMonth.y, metricsMonth.m, settings),
    [shifts, metricsMonth.y, metricsMonth.m, settings],
  );

  const summary = useMemo(
    () =>
      computeWorkforceSummary(workers, shifts, metricsMonth.y, metricsMonth.m, settings, pendingRequests),
    [workers, shifts, metricsMonth.y, metricsMonth.m, settings, pendingRequests],
  );

  function openAdd(dateIso: string) {
    setShiftModal({ shift: null, defaultDate: dateIso });
  }

  function openEdit(s: Shift) {
    setShiftModal({ shift: s, defaultDate: s.date });
  }

  const certsOf = (d: ShiftDraft) => (d.required_certifications ?? []).filter(Boolean);

  async function saveShift(draft: ShiftDraft) {
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
            zone_id: draft.zoneId || null,
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
      const sh = shifts.find((s) => s.id === shiftId);
      if (!sh) return;
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
    [addShift, reloadPulseSchedule, shifts, updateShift],
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

  const projectDayTint = useMemo(() => {
    const tint: Record<string, string> = {};
    if (calendarScale === "month") {
      for (const c of monthGrid(cursor.y, cursor.m)) {
        if (c.inMonth && c.dayOfMonth % 6 === 1) tint[c.date] = "bg-indigo-200/40 dark:bg-indigo-500/20";
      }
    } else if (calendarScale === "week") {
      weekDates.forEach((date, i) => {
        if (i % 2 === 0) tint[date] = "bg-indigo-200/40 dark:bg-indigo-500/20";
      });
    }
    return tint;
  }, [calendarScale, cursor.y, cursor.m, weekDates]);

  const dayDisplayShifts = useMemo(
    () => displayShifts.filter((s) => s.date === focusDate),
    [displayShifts, focusDate],
  );

  const dayAllShifts = useMemo(() => shifts.filter((s) => s.date === focusDate), [shifts, focusDate]);

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
      <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-pulse-bg -mx-4 px-4 sm:-mx-5 sm:px-5">
        <div className="mx-auto w-full max-w-2xl py-10">
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
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-pulse-bg -mx-4 px-4 sm:-mx-5 sm:px-5">
      <div className="flex-1 pb-4">
        <div className={scheduleDragLock ? "pointer-events-none" : ""}>
          <PageHeader
            title="Schedule"
            description="Plan shifts, zones, and coverage across your operation."
            icon={CalendarDays}
            actions={
              <>
                <nav
                  className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]"
                  aria-label="Schedule views"
                >
                  {(
                    [
                      ["calendar", "Calendar", CalendarDays],
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
                          ? "bg-gray-900 text-white shadow-sm dark:bg-gray-100 dark:text-gray-900"
                          : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
                      }`}
                    >
                      <Icon className="h-4 w-4 opacity-90" />
                      {label}
                    </button>
                  ))}
                </nav>
                <button
                  type="button"
                  onClick={() => setTimeOffOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#0F172A]"
                >
                  <CalendarPlus className="h-4 w-4" />
                  Time off
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#111827] dark:text-gray-100 dark:hover:bg-[#0F172A]"
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
                className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]"
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
                        ? "bg-gray-900 text-white shadow-sm dark:bg-gray-100 dark:text-gray-900"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 opacity-90" />
                    {label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="hidden h-6 w-px bg-gray-200 dark:bg-[#1F2937] sm:block" aria-hidden />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">Show</span>
              <nav
                id="schedule-toggle"
                className="flex rounded-xl border border-gray-200 bg-white p-1 shadow-sm dark:border-[#1F2937] dark:bg-[#111827]"
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
                        ? "bg-gray-900 text-white shadow-sm dark:bg-gray-100 dark:text-gray-900"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-100"
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
              className="pointer-events-none fixed inset-0 z-[115] bg-slate-900/[0.06] dark:bg-black/25"
              aria-hidden
            />
          ) : null}
          {view === "calendar" ? (
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
              <div className="min-w-0 flex-1 space-y-4">
                {calendarScale === "day" ? (
                  <div className="space-y-3">
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm dark:border-[#1F2937] dark:bg-[#111827] ${scheduleDragLock ? "pointer-events-none" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
                          onClick={() => setFocusDate((p) => addDaysToIso(p, -1))}
                          aria-label="Previous day"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
                          onClick={goToday}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-gray-200 bg-white p-2 text-gray-900 shadow-sm hover:bg-gray-50 dark:border-[#1F2937] dark:bg-[#0F172A] dark:text-gray-100 dark:hover:bg-[#111827]"
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
                      onShiftDragSessionStart={setDragSession}
                      onShiftDragSessionEnd={() => {
                        setDragSession(null);
                        setTrashHovering(false);
                      }}
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
                    onOpenDay={(iso) => {
                      setFocusDate(iso);
                      setCalendarScale("day");
                    }}
                    projectDayTint={projectDayTint}
                    scheduleDragLock={scheduleDragLock}
                    dragSession={dragSession}
                    calendarDropsDisabled={calendarDropsDisabled}
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
                    onOpenDay={(iso) => {
                      setFocusDate(iso);
                      setCalendarScale("day");
                    }}
                    projectDayTint={projectDayTint}
                    scheduleDragLock={scheduleDragLock}
                    dragSession={dragSession}
                    calendarDropsDisabled={calendarDropsDisabled}
                    onShiftDragSessionStart={setDragSession}
                    onShiftDragSessionEnd={() => {
                      setDragSession(null);
                      setTrashHovering(false);
                    }}
                  />
                ) : null}
              </div>
              <div className="w-full shrink-0 xl:w-72">
                <ScheduleLegendPanel
                  shiftTypes={shiftTypes}
                  workers={workers}
                  shifts={displayShifts}
                  contentFilter={contentFilter}
                />
              </div>
            </div>
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
        allShifts={shifts}
        onClose={() => setShiftModal(null)}
        onSave={saveShift}
        onDelete={
          shiftModal?.shift
            ? async (id) => {
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
              }
            : undefined
        }
      />

      <ScheduleSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ScheduleTrashDropZone
        active={scheduleDragLock}
        isDuplicateDrag={!!dragSession?.duplicate}
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
          setDeleteToast("Shift deleted");
        }}
      />

      {deleteToast ? (
        <div
          className="pointer-events-none fixed bottom-24 left-1/2 z-[150] -translate-x-1/2 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg dark:border-[#1F2937] dark:bg-[#111827] sm:bottom-28"
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
