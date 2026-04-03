"use client";

import { BarChart2, CalendarDays, CalendarPlus, Settings, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatLocalDate, monthGrid } from "@/lib/schedule/calendar";
import { computeAlerts, computeWorkforceSummary } from "@/lib/schedule/selectors";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import type { Shift } from "@/lib/schedule/types";
import { ScheduleAlertsBanner } from "./ScheduleAlertsBanner";
import { ScheduleCalendarGrid } from "./ScheduleCalendarGrid";
import { ScheduleDayView } from "./ScheduleDayView";
import { SchedulePersonnel } from "./SchedulePersonnel";
import { ScheduleReports } from "./ScheduleReports";
import { ScheduleSettingsModal } from "./ScheduleSettingsModal";
import { ScheduleTrashDropZone } from "./ScheduleTrashDropZone";
import { ScheduleWorkforceBar } from "./ScheduleWorkforceBar";
import type { ShiftDraft } from "./ShiftEditModal";
import { ShiftEditModal } from "./ShiftEditModal";
import { TimeOffRequestModal } from "./TimeOffRequestModal";

type View = "calendar" | "personnel" | "reports";

export function ScheduleApp() {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [view, setView] = useState<View>("calendar");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [dayViewDate, setDayViewDate] = useState<string | null>(null);
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

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useScheduleStore.persist.onFinishHydration(() => setHydrated(true));
    if (useScheduleStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      void useScheduleStore.persist.rehydrate();
    }
    return unsub;
  }, []);

  const defaultDate = useMemo(() => {
    const today = new Date();
    if (today.getFullYear() === cursor.y && today.getMonth() === cursor.m) {
      return formatLocalDate(today);
    }
    return formatLocalDate(new Date(cursor.y, cursor.m, 1));
  }, [cursor.y, cursor.m]);

  const alerts = useMemo(
    () => computeAlerts(shifts, cursor.y, cursor.m, settings),
    [shifts, cursor.y, cursor.m, settings],
  );

  const summary = useMemo(
    () => computeWorkforceSummary(workers, shifts, cursor.y, cursor.m, settings, pendingRequests),
    [workers, shifts, cursor.y, cursor.m, settings, pendingRequests],
  );

  function openAdd(dateIso: string) {
    setShiftModal({ shift: null, defaultDate: dateIso });
  }

  function openEdit(s: Shift) {
    setShiftModal({ shift: s, defaultDate: s.date });
  }

  const certsOf = (d: ShiftDraft) => (d.required_certifications ?? []).filter(Boolean);

  function saveShift(draft: ShiftDraft) {
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
    (shiftId: string, targetDate: string, mode: "move" | "duplicate") => {
      const sh = shifts.find((s) => s.id === shiftId);
      if (!sh) return;
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
    [addShift, shifts, updateShift],
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

  const projectDayTint = useMemo(() => {
    const tint: Record<string, string> = {};
    for (const c of monthGrid(cursor.y, cursor.m)) {
      if (c.inMonth && c.dayOfMonth % 6 === 1) tint[c.date] = "bg-indigo-200/40";
    }
    return tint;
  }, [cursor.y, cursor.m]);

  const dayViewShifts = useMemo(() => {
    if (!dayViewDate) return [];
    return shifts.filter((s) => s.date === dayViewDate);
  }, [shifts, dayViewDate]);

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
      <div className="flex min-h-[40vh] items-center justify-center text-sm text-pulse-muted">
        Loading schedule…
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-pulse-bg">
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between ${scheduleDragLock ? "pointer-events-none" : ""}`}>
          <div>
            <h1 className="font-headline text-2xl font-bold tracking-tight text-pulse-navy">Schedule</h1>
            <p className="mt-1 text-sm text-pulse-muted">Plan shifts, zones, and coverage across your operation.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav
              className="flex rounded-xl border border-slate-200/90 bg-white p-1 shadow-sm"
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
                    if (key !== "calendar") setDayViewDate(null);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    view === key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-pulse-muted hover:bg-slate-50 hover:text-pulse-navy"
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
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50"
            >
              <CalendarPlus className="h-4 w-4" />
              Time off
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
          </div>
        </div>

        <div className={`mt-5 ${scheduleDragLock ? "pointer-events-none" : ""}`}>
          <ScheduleAlertsBanner alerts={alerts} />
        </div>

        <div className="relative mt-5">
          {scheduleDragLock ? (
            <div
              className="pointer-events-none fixed inset-0 z-[115] bg-slate-900/[0.06]"
              aria-hidden
            />
          ) : null}
          {view === "calendar" ? (
            dayViewDate ? (
              <ScheduleDayView
                date={dayViewDate}
                onClose={() => setDayViewDate(null)}
                shifts={dayViewShifts}
                dayShiftsAll={dayViewShifts}
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
            ) : (
              <ScheduleCalendarGrid
                year={cursor.y}
                monthIndex={cursor.m}
                onPrevMonth={prevMonth}
                onNextMonth={nextMonth}
                shifts={shifts}
                workers={workers}
                zones={zones}
                roles={roles}
                shiftTypes={shiftTypes}
                settings={settings}
                timeOffBlocks={timeOffBlocks}
                onSelectShift={openEdit}
                onAddForDate={openAdd}
                onShiftMove={handleShiftMove}
                onOpenDay={(iso) => setDayViewDate(iso)}
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
            )
          ) : null}
          {view === "personnel" ? (
            <SchedulePersonnel
              workers={workers}
              shifts={shifts}
              roles={roles}
              year={cursor.y}
              monthIndex={cursor.m}
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
        onDelete={shiftModal?.shift ? (id) => deleteShift(id) : undefined}
      />

      <ScheduleSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <ScheduleTrashDropZone
        active={scheduleDragLock}
        isDuplicateDrag={!!dragSession?.duplicate}
        onHoverChange={setTrashHovering}
        onDropTrash={(id) => {
          deleteShift(id);
          setDragSession(null);
          setTrashHovering(false);
          setDeleteToast("Shift deleted");
        }}
      />

      {deleteToast ? (
        <div
          className="pointer-events-none fixed bottom-24 left-1/2 z-[150] -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white shadow-lg sm:bottom-28"
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
