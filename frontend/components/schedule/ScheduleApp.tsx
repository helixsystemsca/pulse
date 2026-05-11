"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SettingsGear } from "@/components/settings/SettingsGear";
import { cn } from "@/lib/cn";
import { apiFetch, isApiMode } from "@/lib/api";
import { getServerDate } from "@/lib/serverTime";
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
  weekRangeLabel,
} from "@/lib/schedule/calendar";
import { evaluateCoverageRules } from "@/lib/schedule/coverage-rules";
import { mergeDeploymentBadgeOverlays } from "@/lib/schedule/deployment-overlay";
import type { PaletteDragPayload } from "@/lib/schedule/drag";
import {
  defaultWindowForShiftBand,
  inferShiftTypeFromStart,
  isEphemeralScheduleShiftId,
  mergeEphemeralSchedule,
  normalizeWeekdayKey,
  weekdayKeyFromIso,
} from "@/lib/schedule/recurring";
import { logScheduleAuditEvent } from "@/lib/schedule/schedule-audit-log";
import { inferStandardShiftCode, standardShiftByCode } from "@/lib/schedule/shift-definition-catalog";
import { placementBandDropdownOptions, resolvePlacementRoles } from "@/lib/schedule/placement-panel-options";
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
import {
  auxiliaryWorkers,
  countPendingSubmissions,
  loadSubmissionMap,
} from "@/lib/schedule/availability-supervisor-local";
import { computeAlerts } from "@/lib/schedule/selectors";
import { useScheduleStore } from "@/lib/schedule/schedule-store";
import type { ScheduleDragSession, SchedulePlacementBand, Shift } from "@/lib/schedule/types";
import { canAccessCompanyConfiguration, sessionHasAnyRole } from "@/lib/pulse-roles";
import { readSession } from "@/lib/pulse-session";
import { AvailabilitySupervisorDrawer } from "./availability/AvailabilitySupervisorDrawer";
import { EmployeeAvailabilityDrawer } from "./availability/EmployeeAvailabilityDrawer";
import { ScheduleBuilderActions, type SchedulePeriodHeaderState } from "./ScheduleBuilderHeader";
import { SchedulePageHeader } from "./SchedulePageHeader";
import { ScheduleUnifiedControlCard } from "./ScheduleUnifiedControlCard";
import { ScheduleOperationalStatusStrip } from "./ScheduleOperationalStatusStrip";
import { ScheduleOperationalSidebar, type ScheduleWorkspaceView } from "./ScheduleOperationalSidebar";
import { useModuleSettings } from "@/providers/ModuleSettingsProvider";
import { ScheduleAssignmentPalette } from "./ScheduleAssignmentPalette";
import { ScheduleCalendarGrid } from "./ScheduleCalendarGrid";
import { ScheduleDayView } from "./ScheduleDayView";
import { ScheduleLegendPanel, type ScheduleProjectLegendItem } from "./ScheduleLegendPanel";
import { ScheduleMyShiftsView } from "./ScheduleMyShiftsView";
import { SchedulePersonnel } from "./SchedulePersonnel";
import { ScheduleReports } from "./ScheduleReports";
import { ScheduleSettingsModal } from "./ScheduleSettingsModal";
import { AvailabilityOverrideModal } from "./operational/AvailabilityOverrideModal";
import { ScheduleTrashDropZone } from "./ScheduleTrashDropZone";
import { Card } from "@/components/pulse/Card";
import { ScheduleWeekView } from "./ScheduleWeekView";
import { ScheduleDraftPanel, type DraftResult } from "./ScheduleDraftPanel";
import { SchedulePeriodModal, type SchedulePeriodLite } from "./SchedulePeriodModal";
import {
  ScheduleToolbar,
  type ScheduleContentFilter,
  type ScheduleTimeScale,
} from "./ScheduleToolbar";
import { ScheduleWorkerPanel } from "./ScheduleWorkerPanel";
import type { ShiftDraft } from "./ShiftEditModal";
import { ShiftEditModal } from "./ShiftEditModal";
import { TimeOffRequestModal } from "./TimeOffRequestModal";
import { WorkerAttendanceModal } from "./WorkerAttendanceModal";

function shiftLengthHours(sh: Pick<Shift, "startTime" | "endTime">): number {
  const [shh, smm] = sh.startTime.split(":").map(Number);
  const [ehh, emm] = sh.endTime.split(":").map(Number);
  if (![shh, smm, ehh, emm].every((n) => Number.isFinite(n))) return 0;
  let mins = ehh * 60 + emm - (shh * 60 + smm);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

type AvailabilityOverrideState =
  | { kind: "worker"; workerId: string; date: string; detail: string }
  | { kind: "paletteShift"; workerId: string; date: string; code: string; detail: string };

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
  const canConfigureOrg = canAccessCompanyConfiguration(session);
  const currentUserId = session?.sub ?? null;
  const canPublishSchedule = sessionHasAnyRole(session, "manager", "supervisor", "company_admin", "system_admin");
  const canEdit = canPublishSchedule;

  const scheduleMod = useModuleSettings("schedule");
  const scheduleFlags = scheduleMod.settings as { allowShiftOverrides?: boolean };
  const shiftDragEnabled = scheduleFlags.allowShiftOverrides !== false;
  // Worker → calendar drag creates a new shift; keep enabled even when shift overrides are locked down.
  const workerDragEnabled = true;

  const [cursor, setCursor] = useState(() => {
    const n = getServerDate();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [workspaceView, setWorkspaceView] = useState<ScheduleWorkspaceView>("calendar");
  const [timeScale, setTimeScale] = useState<ScheduleTimeScale>("month");
  const [focusDate, setFocusDate] = useState(() => formatLocalDate(getServerDate()));
  const [contentFilter, setContentFilter] = useState<ScheduleContentFilter>("combined");
  const [sidebarSearch, setSidebarSearch] = useState("");
  const [facilityFilterIds, setFacilityFilterIds] = useState<string[]>([]);
  const [availabilitySupervisorOpen, setAvailabilitySupervisorOpen] = useState(false);
  const [employeeAvailabilityOpen, setEmployeeAvailabilityOpen] = useState(false);
  const [availabilityMatrixVersion, setAvailabilityMatrixVersion] = useState(0);
  const [publishBusy, setPublishBusy] = useState(false);
  const [shiftDefinitions, setShiftDefinitions] = useState<{ id: string; code: string; name?: string | null }[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const [dragSession, setDragSession] = useState<ScheduleDragSession | null>(null);
  const [placementDutyRole, setPlacementDutyRole] = useState<string>("worker");
  const [placementBand, setPlacementBand] = useState<SchedulePlacementBand>("template");
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);
  const [buildingDraft, setBuildingDraft] = useState(false);
  const [trashHovering, setTrashHovering] = useState(false);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [activePeriod, setActivePeriod] = useState<SchedulePeriodLite | null>(null);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [scheduleProjects, setScheduleProjects] = useState<ProjectRow[] | null>(null);
  const [showProjectOverlay, setShowProjectOverlay] = useState(true);
  const schedulePath = usePathname() ?? "";
  const [shiftModal, setShiftModal] = useState<{
    shift: Shift | null;
    defaultDate: string;
  } | null>(null);
  const [availabilityOverride, setAvailabilityOverride] = useState<AvailabilityOverrideState | null>(null);
  const [scheduleToast, setScheduleToast] = useState<string | null>(null);
  const [workerAttendanceModal, setWorkerAttendanceModal] = useState<{
    workerId: string;
    date: string;
    label: string;
  } | null>(null);

  const shifts = useScheduleStore((s) => s.shifts);
  const workers = useScheduleStore((s) => s.workers);
  const zones = useScheduleStore((s) => s.zones);
  const roles = useScheduleStore((s) => s.roles);
  const shiftTypes = useScheduleStore((s) => s.shiftTypes);
  const settings = useScheduleStore((s) => s.settings);
  const timeOffBlocks = useScheduleStore((s) => s.timeOffBlocks);
  const addShift = useScheduleStore((s) => s.addShift);
  const updateShift = useScheduleStore((s) => s.updateShift);
  const deleteShift = useScheduleStore((s) => s.deleteShift);
  const addTimeOffBlock = useScheduleStore((s) => s.addTimeOffBlock);
  const applyPulseScheduleSnapshot = useScheduleStore((s) => s.applyPulseScheduleSnapshot);
  const setWorkers = useScheduleStore((s) => s.setWorkers);
  const deploymentBadgeOverlays = useScheduleStore((s) => s.deploymentBadgeOverlays);
  const addDeploymentBadge = useScheduleStore((s) => s.addDeploymentBadge);

  const placementRoleChoices = useMemo(
    () => resolvePlacementRoles(roles, settings.placementPanelRoleIds),
    [roles, settings.placementPanelRoleIds],
  );

  const allowedPlacementBands = useMemo(
    () => placementBandDropdownOptions(settings).map((o) => o.band),
    [settings],
  );

  useEffect(() => {
    const ids = placementRoleChoices.map((r) => r.id);
    if (ids.length === 0) return;
    if (!ids.includes(placementDutyRole)) {
      setPlacementDutyRole(ids[0]!);
    }
  }, [placementRoleChoices, placementDutyRole]);

  useEffect(() => {
    if (!allowedPlacementBands.length) return;
    if (!allowedPlacementBands.includes(placementBand)) {
      setPlacementBand(allowedPlacementBands[0]!);
    }
  }, [allowedPlacementBands, placementBand]);

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
    if (timeScale === "month") {
      const first = new Date(cursor.y, cursor.m, 1);
      const last = new Date(cursor.y, cursor.m + 1, 0);
      from = new Date(first);
      from.setHours(0, 0, 0, 0);
      to = new Date(last);
      to.setHours(23, 59, 59, 999);
    } else if (timeScale === "week") {
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
  }, [applyPulseScheduleSnapshot, timeScale, cursor.m, cursor.y, focusDate]);

  const reloadActivePeriod = useCallback(async () => {
    if (!hydrated || !canEdit || !isApiMode()) return;
    try {
      const periods = await apiFetch<SchedulePeriodLite[]>(`/api/v1/pulse/schedule/periods`);
      const open = periods?.find((p) => p?.status === "open" || p?.status === "draft");
      setActivePeriod(open ?? null);
    } catch {
      // non-fatal
    }
  }, [canEdit, hydrated]);

  const scheduleFacilitySettingsKey = useMemo(() => {
    const s = scheduleMod.settings as { facilityCount?: number; facilityLabels?: string[] };
    return `${s.facilityCount ?? ""}:${JSON.stringify(s.facilityLabels ?? [])}`;
  }, [scheduleMod.settings]);

  useEffect(() => {
    if (!hydrated || !isApiMode()) return;
    void reloadPulseSchedule();
  }, [hydrated, reloadPulseSchedule, scheduleFacilitySettingsKey]);

  useEffect(() => {
    void reloadActivePeriod();
  }, [reloadActivePeriod]);

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
    if (timeScale === "month") return monthGrid(cursor.y, cursor.m).map((c) => c.date);
    if (timeScale === "week") return weekDatesFromSunday(focusDate);
    return [focusDate];
  }, [timeScale, cursor.y, cursor.m, focusDate]);

  const placementDropWindow = useMemo(
    () => (placementBand === "template" ? null : defaultWindowForShiftBand(placementBand)),
    [placementBand],
  );

  const shiftsForView = useMemo(() => {
    const zid = zones[0]?.id ?? shifts[0]?.zoneId ?? "";
    const base = !zid ? shifts : mergeEphemeralSchedule(shifts, workers, visibleDatesForScheduleMerge, timeOffBlocks, zid);
    return mergeDeploymentBadgeOverlays(base, deploymentBadgeOverlays);
  }, [shifts, workers, visibleDatesForScheduleMerge, timeOffBlocks, zones, deploymentBadgeOverlays]);

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

  const displayShiftsForGrid = useMemo(() => {
    if (!facilityFilterIds.length) return displayShifts;
    return displayShifts.filter((s) => facilityFilterIds.includes(s.zoneId));
  }, [displayShifts, facilityFilterIds]);

  const workersForPanel = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return workers;
    return workers.filter((w) => w.name.toLowerCase().includes(q));
  }, [workers, sidebarSearch]);

  const pendingAvailabilityCount = useMemo(() => {
    void availabilityMatrixVersion;
    const ids = auxiliaryWorkers(workers).map((w) => w.id);
    return countPendingSubmissions(loadSubmissionMap(), ids);
  }, [workers, availabilityMatrixVersion]);

  const workerHighlightMap = useMemo(() => {
    if (dragSession?.kind !== "worker") return null;
    const w = workers.find((x) => x.id === dragSession.workerId);
    if (!w) return null;
    const dates =
      timeScale === "week"
        ? weekDatesFromSunday(focusDate)
        : timeScale === "month"
          ? monthGrid(cursor.y, cursor.m).map((c) => c.date)
          : [focusDate];
    return buildWorkerDragHighlightMap(w, dates, shiftsForView, settings, timeOffBlocks, placementDropWindow);
  }, [
    dragSession,
    workers,
    shiftsForView,
    settings,
    timeOffBlocks,
    timeScale,
    cursor.y,
    cursor.m,
    focusDate,
    placementDropWindow,
  ]);

  const weekDates = useMemo(() => weekDatesFromSunday(focusDate), [focusDate]);

  const metricsMonth = useMemo(() => {
    if (timeScale === "month") {
      return { y: cursor.y, m: cursor.m };
    }
    const d = parseLocalDate(focusDate);
    return { y: d.getFullYear(), m: d.getMonth() };
  }, [timeScale, cursor.y, cursor.m, focusDate]);

  const defaultDate = useMemo(() => {
    if (timeScale === "day") return focusDate;
    const today = getServerDate();
    if (today.getFullYear() === cursor.y && today.getMonth() === cursor.m) {
      return formatLocalDate(today);
    }
    return formatLocalDate(new Date(cursor.y, cursor.m, 1));
  }, [timeScale, focusDate, cursor.y, cursor.m]);

  const alerts = useMemo(
    () => {
      const base = computeAlerts(shiftsForView, workers, metricsMonth.y, metricsMonth.m, settings);
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

  const schedulePeriodState: SchedulePeriodHeaderState = activePeriod
    ? {
        kind: "active",
        status: activePeriod.status === "open" ? "open" : "draft",
        rangeLabel: `${activePeriod.start_date} – ${activePeriod.end_date}`,
        deadlineLabel: activePeriod.availability_deadline
          ? ` · Due ${new Date(activePeriod.availability_deadline).toLocaleDateString()}`
          : null,
      }
    : { kind: "empty", allowCreate: canEdit };

  const viewPeriodMeta = useMemo(() => {
    if (timeScale === "month") {
      const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
      const d = new Date(cursor.y, cursor.m, 1);
      return {
        label: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        sub: `${daysInMonth} days · Calendar month`,
      };
    }
    if (timeScale === "week") {
      return { label: weekRangeLabel(weekDates), sub: "7 days · Week range" };
    }
    try {
      const label = new Date(`${focusDate}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return { label, sub: "Single day view" };
    } catch {
      return { label: focusDate, sub: "Single day view" };
    }
  }, [timeScale, cursor.y, cursor.m, weekDates, focusDate]);

  function openAdd(dateIso: string) {
    setShiftModal({ shift: null, defaultDate: dateIso });
  }

  function openEdit(s: Shift) {
    setShiftModal({ shift: s, defaultDate: s.date });
  }

  const handlePublish = useCallback(async () => {
    if (!visibleDatesForScheduleMerge.length) return;
    setPublishBusy(true);
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
      setScheduleToast("Schedule published and workers notified.");
    } catch (e) {
      console.error("Publish failed", e);
      setScheduleToast("Publish failed — check your connection and try again.");
    } finally {
      setPublishBusy(false);
    }
  }, [visibleDatesForScheduleMerge, setScheduleToast]);

  const handleBuildDraft = useCallback(async () => {
    if (!visibleDatesForScheduleMerge.length) return;
    setBuildingDraft(true);
    try {
      const toMin = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      const startMin = toMin(settings.workDayStart || "07:00");
      const endMin = toMin(settings.workDayEnd || "15:00");

      const slots = visibleDatesForScheduleMerge.map((date) => ({
        date,
        start_min: startMin,
        end_min: endMin,
        shift_type: "shift",
        shift_definition_id: null,
        shift_code: null,
        required_certs: [] as string[],
        facility_id: zones[0]?.id ?? null,
      }));

      const url = "/api/v1/pulse/schedule/draft";

      const result = await apiFetch<DraftResult>(url, {
        method: "POST",
        json: {
          slots,
          period_start: visibleDatesForScheduleMerge[0],
          period_end: visibleDatesForScheduleMerge[visibleDatesForScheduleMerge.length - 1],
          max_hours_per_worker: settings.staffing.maxHoursPerWorkerPerWeek || 160,
          fairness_enabled: true,
        },
      });
      setDraftResult(result);
    } catch (e) {
      console.error("Draft build failed", e);
    } finally {
      setBuildingDraft(false);
    }
  }, [visibleDatesForScheduleMerge, settings, zones]);

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
    (workerId: string, targetDate: string, availabilityOverrideReason?: string | null) => {
      const w = workers.find((x) => x.id === workerId);
      if (!w) return;
      const trimmedOverride =
        typeof availabilityOverrideReason === "string" && availabilityOverrideReason.trim().length > 0
          ? availabilityOverrideReason.trim()
          : null;

      const ev = evaluateWorkerDrop(w, targetDate, shiftsForView, settings, timeOffBlocks, placementDropWindow, {
        treatRestrictionsAsSatisfied: Boolean(trimmedOverride),
      });
      if (!ev.ok) {
        if (!trimmedOverride && ev.needsManagerOverride && canPublishSchedule) {
          setAvailabilityOverride({
            kind: "worker",
            workerId,
            date: targetDate,
            detail: ev.tooltip ?? "Constraint conflict for this placement.",
          });
          return;
        }
        if (!trimmedOverride) {
          setScheduleToast(ev.tooltip ?? "Employee marked unavailable for this day.");
          return;
        }
        setScheduleToast(ev.tooltip ?? "Cannot complete this placement.");
        return;
      }

      const dow = weekdayKeyFromIso(targetDate);
      const rule = w.recurringShifts?.find((r) => normalizeWeekdayKey(String(r.dayOfWeek)) === dow);
      let start: string;
      let end: string;
      let shiftType: Shift["shiftType"];
      let requiredCerts: string[] | undefined;
      if (placementBand === "template") {
        start = rule?.start ?? settings.workDayStart;
        end = rule?.end ?? settings.workDayEnd;
        shiftType = inferShiftTypeFromStart(start);
        requiredCerts = rule?.requiredCertifications?.filter(Boolean);
      } else {
        const win = defaultWindowForShiftBand(placementBand);
        start = win.start;
        end = win.end;
        shiftType = placementBand;
        requiredCerts = undefined;
      }
      const zoneId = zones[0]?.id ?? shiftsForView[0]?.zoneId ?? "";
      if (!zoneId) return;

      if (trimmedOverride) {
        const actor = (session?.full_name ?? session?.email ?? "user").trim() || "user";
        logScheduleAuditEvent({
          type: "availability_override",
          actorLabel: actor,
          workerId: w.id,
          date: targetDate,
          reason: trimmedOverride,
        });
      }

      const code = inferStandardShiftCode(start, end);
      addShift({
        workerId: w.id,
        date: targetDate,
        startTime: start,
        endTime: end,
        shiftType,
        eventType: "work",
        role: placementDutyRole as Shift["role"],
        zoneId,
        shiftKind: "workforce",
        required_certifications: requiredCerts,
        shiftCode: code,
        availabilityOverrideReason: trimmedOverride,
        uiFlags: { isNew: true },
      });
    },
    [
      addShift,
      canPublishSchedule,
      placementBand,
      placementDutyRole,
      placementDropWindow,
      session?.email,
      session?.full_name,
      shiftsForView,
      settings,
      timeOffBlocks,
      workers,
      zones,
    ],
  );

  const commitPaletteShiftAssignment = useCallback(
    (workerId: string, targetDate: string, shiftCode: string, availabilityOverrideReason?: string | null) => {
      const w = workers.find((x) => x.id === workerId);
      if (!w) return;
      const trimmedOverride =
        typeof availabilityOverrideReason === "string" && availabilityOverrideReason.trim().length > 0
          ? availabilityOverrideReason.trim()
          : null;

      const def = standardShiftByCode(shiftCode);
      if (!def) {
        setScheduleToast(`Unknown shift code: ${shiftCode}`);
        return;
      }

      const ev = evaluateWorkerDrop(w, targetDate, shiftsForView, settings, timeOffBlocks, placementDropWindow, {
        treatRestrictionsAsSatisfied: Boolean(trimmedOverride),
      });
      if (!ev.ok) {
        setScheduleToast(ev.tooltip ?? "Cannot assign this shift.");
        return;
      }

      if (trimmedOverride) {
        const actor = (session?.full_name ?? session?.email ?? "user").trim() || "user";
        logScheduleAuditEvent({
          type: "availability_override",
          actorLabel: actor,
          workerId: w.id,
          date: targetDate,
          reason: trimmedOverride,
        });
      }

      const zoneId = zones[0]?.id ?? shiftsForView[0]?.zoneId ?? "";
      if (!zoneId) return;

      const dayAssignments = shifts.filter(
        (s) =>
          s.workerId === workerId &&
          s.date === targetDate &&
          s.shiftKind !== "project_task" &&
          s.eventType !== "vacation" &&
          s.eventType !== "sick",
      );
      const targetShift = dayAssignments.find((s) => s.eventType === "work" || s.eventType === "training") ?? null;

      const weeklyCap = Number(scheduleMod.settings.enforceMaxHours) || 0;
      if (weeklyCap > 0 && w) {
        const draftLen = shiftLengthHours({ startTime: def.start, endTime: def.end });
        const withShift =
          weeklyAssignedHours(shiftsForView, workerId, targetDate, targetShift?.id) + draftLen;
        if (withShift > weeklyCap + 1e-6) {
          window.alert(
            `This assignment would exceed the ${weeklyCap}h weekly limit (${withShift.toFixed(1)}h). Change schedule settings or adjust shifts.`,
          );
          return;
        }
      }

      if (targetShift && !isEphemeralScheduleShiftId(targetShift.id)) {
        if (isApiMode() && isPulseApiShiftId(targetShift.id)) {
          void (async () => {
            try {
              await apiFetch(`/api/v1/pulse/schedule/shifts/${targetShift.id}`, {
                method: "PATCH",
                json: {
                  starts_at: localDateTimeToIso(targetDate, def.start),
                  ends_at: localDateTimeToIso(targetDate, def.end),
                  shift_type: def.band,
                },
              });
              await reloadPulseSchedule();
            } catch {
              updateShift(targetShift.id, {
                startTime: def.start,
                endTime: def.end,
                shiftType: def.band,
                shiftCode: def.code,
                ...(trimmedOverride ? { availabilityOverrideReason: trimmedOverride } : {}),
                uiFlags: { ...targetShift.uiFlags, isUpdated: true },
              });
            }
          })();
          return;
        }
        updateShift(targetShift.id, {
          startTime: def.start,
          endTime: def.end,
          shiftType: def.band,
          shiftCode: def.code,
          ...(trimmedOverride ? { availabilityOverrideReason: trimmedOverride } : {}),
          uiFlags: { ...targetShift.uiFlags, isUpdated: true },
        });
        return;
      }

      addShift({
        workerId: w.id,
        date: targetDate,
        startTime: def.start,
        endTime: def.end,
        shiftType: def.band,
        eventType: "work",
        role: placementDutyRole as Shift["role"],
        zoneId,
        shiftKind: "workforce",
        shiftCode: def.code,
        ...(trimmedOverride ? { availabilityOverrideReason: trimmedOverride } : {}),
        uiFlags: { isNew: true },
      });
    },
    [
      addShift,
      placementDutyRole,
      placementDropWindow,
      reloadPulseSchedule,
      scheduleMod.settings.enforceMaxHours,
      session?.email,
      session?.full_name,
      settings,
      shifts,
      shiftsForView,
      timeOffBlocks,
      updateShift,
      workers,
      zones,
    ],
  );

  const handlePaletteDrop = useCallback(
    (workerId: string, targetDate: string, payload: PaletteDragPayload) => {
      setDragSession(null);
      setTrashHovering(false);

      const w = workers.find((x) => x.id === workerId);
      if (!w) return;

      if (payload.paletteKind === "badge") {
        addDeploymentBadge(workerId, targetDate, payload.code);
        return;
      }

      const def = standardShiftByCode(payload.code);
      if (!def) {
        setScheduleToast(`Unknown shift code: ${payload.code}`);
        return;
      }

      const ev = evaluateWorkerDrop(w, targetDate, shiftsForView, settings, timeOffBlocks, placementDropWindow, {
        treatRestrictionsAsSatisfied: false,
      });
      if (!ev.ok) {
        if (ev.needsManagerOverride && canPublishSchedule) {
          setAvailabilityOverride({
            kind: "paletteShift",
            workerId,
            date: targetDate,
            code: def.code,
            detail: ev.tooltip ?? "Constraint conflict for this placement.",
          });
          return;
        }
        setScheduleToast(ev.tooltip ?? "Cannot assign this shift.");
        return;
      }

      commitPaletteShiftAssignment(workerId, targetDate, def.code, null);
    },
    [
      addDeploymentBadge,
      canPublishSchedule,
      commitPaletteShiftAssignment,
      placementDropWindow,
      settings,
      shiftsForView,
      timeOffBlocks,
      workers,
    ],
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
    if (timeScale !== "day" || !projectBarItems) return null;
    return projectBarItems
      .filter((p) => focusDate >= p.start_date && focusDate <= p.end_date)
      .map((p) => ({ id: p.id, name: p.name, tintClass: p.tintClass }));
  }, [timeScale, focusDate, projectBarItems]);

  const dayDisplayShifts = useMemo(
    () => displayShiftsForGrid.filter((s) => s.date === focusDate),
    [displayShiftsForGrid, focusDate],
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

  useEffect(() => {
    if (!scheduleToast) return;
    const t = window.setTimeout(() => setScheduleToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [scheduleToast]);

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
        <div className="w-full py-6">
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

  const builderActions = (
    <ScheduleBuilderActions
      showSaveDraft={isApiMode() && canEdit}
      saveDraftDisabled={saveBusy || !hasPendingServerSave}
      saveBusy={saveBusy}
      onSaveDraft={() => void saveScheduleToServer()}
      showPublish={canPublishSchedule && isApiMode()}
      publishBusy={publishBusy}
      onPublish={() => void handlePublish()}
      showBuildDraft={Boolean(canPublishSchedule && isApiMode() && !draftResult)}
      buildingDraft={buildingDraft}
      onBuildDraft={() => void handleBuildDraft()}
      moreMenu={
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-ds-foreground hover:bg-ds-interactive-hover"
            onClick={() => setTimeOffOpen(true)}
          >
            Time off
          </button>
          {canConfigureOrg ? (
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-ds-foreground hover:bg-ds-interactive-hover"
              onClick={() => setSettingsOpen(true)}
            >
              Schedule settings
            </button>
          ) : null}
          <div className="border-t border-pulseShell-border pt-2 dark:border-slate-700">
            <SettingsGear module="schedule" label="Module preferences" className="w-full justify-center border-pulseShell-border" />
          </div>
        </div>
      }
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pb-2">
      <div className={`min-h-0 flex-1 space-y-2 ${scheduleDragLock ? "pointer-events-none" : ""}`}>
        <SchedulePageHeader actions={builderActions} />

        {workspaceView === "calendar" ? (
          <ScheduleUnifiedControlCard
            operationsRow={
              <ScheduleOperationalSidebar
                variant="inline"
                collapsed={false}
                onToggleCollapsed={() => {}}
                searchQuery={sidebarSearch}
                onSearchChange={setSidebarSearch}
                workspaceView={workspaceView}
                onWorkspaceViewChange={(v) => {
                  setWorkspaceView(v);
                  if (v !== "calendar") {
                    setTimeScale("month");
                  }
                }}
                zones={zones}
                facilityFilterIds={facilityFilterIds}
                onFacilityFilterToggle={(id) =>
                  setFacilityFilterIds((prev) => (prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]))
                }
                onClearFacilityFilter={() => setFacilityFilterIds([])}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenTimeOff={() => setTimeOffOpen(true)}
                onOpenAvailabilitySupervisor={() => setAvailabilitySupervisorOpen(true)}
                onOpenEmployeeAvailability={() => setEmployeeAvailabilityOpen(true)}
                canConfigureOrg={canConfigureOrg}
                disabled={scheduleDragLock}
              />
            }
            status={
              <ScheduleOperationalStatusStrip
                period={schedulePeriodState}
                viewPeriodLabel={viewPeriodMeta.label}
                viewPeriodSub={viewPeriodMeta.sub}
                alerts={alerts}
                pendingAvailability={pendingAvailabilityCount}
                unpublishedChanges={hasPendingServerSave}
                trainingConflicts={0}
                onManagePeriod={() => setShowPeriodModal(true)}
                onAvailabilityClick={() => setAvailabilitySupervisorOpen(true)}
              />
            }
            controls={
              <ScheduleToolbar
                embedded
                compact
                timeScale={timeScale}
                onTimeScaleChange={setTimeScale}
                contentFilter={contentFilter}
                onContentFilterChange={setContentFilter}
                showProjectOverlay={showProjectOverlay}
                onToggleProjectOverlay={() => setShowProjectOverlay((v) => !v)}
                disabled={scheduleDragLock}
              />
            }
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-pulseShell-border/80 bg-pulseShell-surface/60 px-3 py-2 dark:border-slate-700/80 dark:bg-slate-900/50">
            <ScheduleOperationalSidebar
              variant="inline"
              collapsed={false}
              onToggleCollapsed={() => {}}
              searchQuery={sidebarSearch}
              onSearchChange={setSidebarSearch}
              workspaceView={workspaceView}
              onWorkspaceViewChange={setWorkspaceView}
              zones={zones}
              facilityFilterIds={facilityFilterIds}
              onFacilityFilterToggle={(id) =>
                setFacilityFilterIds((prev) => (prev.includes(id) ? prev.filter((z) => z !== id) : [...prev, id]))
              }
              onClearFacilityFilter={() => setFacilityFilterIds([])}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenTimeOff={() => setTimeOffOpen(true)}
              onOpenAvailabilitySupervisor={() => setAvailabilitySupervisorOpen(true)}
              onOpenEmployeeAvailability={() => setEmployeeAvailabilityOpen(true)}
              canConfigureOrg={canConfigureOrg}
              disabled={scheduleDragLock}
            />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
            {workspaceView === "calendar" ? (
              <>
                {draftResult ? (
                  <ScheduleDraftPanel
                    draft={draftResult}
                    companyId={null}
                    onCommit={() => {
                      setDraftResult(null);
                      void reloadPulseSchedule();
                    }}
                    onDiscard={() => setDraftResult(null)}
                  />
                ) : null}

                <div className="relative flex min-h-0 flex-1 flex-col">
                  {scheduleDragLock ? (
                    <div
                      className="pointer-events-none fixed inset-0 z-[115] bg-[color-mix(in_srgb,var(--ds-text-primary)_6%,transparent)] dark:bg-ds-bg/35"
                      aria-hidden
                    />
                  ) : null}

                  <div
                    className={cn(
                      "grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-[minmax(200px,280px)_1fr] md:grid-rows-1 md:items-stretch lg:grid-cols-[minmax(220px,300px)_1fr] lg:gap-3",
                      // Parent applies `pointer-events-none` during drag to dim accidental clicks; calendar cells must
                      // still receive dragover/drop (pointer-events inherits, so re-enable on this subtree).
                      scheduleDragLock && "pointer-events-auto",
                    )}
                  >
                    <aside className="flex min-h-0 flex-col gap-1.5 overflow-y-auto lg:min-h-0 lg:max-h-full lg:pr-0.5">
                      <div className="shrink-0">
                        <ScheduleWorkerPanel
                          workers={workersForPanel}
                          rosterDragEnabled={workerDragEnabled}
                          dragSession={dragSession}
                          shifts={shifts}
                          roles={roles}
                          placementDutyRole={placementDutyRole}
                          onPlacementDutyRoleChange={setPlacementDutyRole}
                          placementBand={placementBand}
                          onPlacementBandChange={setPlacementBand}
                          onDragSessionStart={setDragSession}
                          onDragSessionEnd={() => {
                            setDragSession(null);
                            setTrashHovering(false);
                          }}
                        />
                      </div>
                      <ScheduleAssignmentPalette
                        disabled={scheduleDragLock && dragSession?.kind !== "palette"}
                        onDragSessionStart={(p) => setDragSession({ kind: "palette", ...p })}
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
                        className="shrink-0 lg:static lg:top-auto lg:max-h-none lg:overflow-visible"
                      />
                    </aside>

                    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                      <div className="min-h-0 flex-1 space-y-2 overflow-x-auto overflow-y-auto">
                {timeScale === "day" ? (
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
                      onClose={() => setTimeScale("month")}
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
                      workerDropPlacementWindow={placementDropWindow}
                      onWorkerDropRejected={(msg) => setScheduleToast(msg)}
                      onWorkerDrop={(workerId) => handleWorkerDrop(workerId, focusDate)}
                      onShiftDragSessionStart={setDragSession}
                      onShiftDragSessionEnd={() => {
                        setDragSession(null);
                        setTrashHovering(false);
                      }}
                      dayProjectBar={dayProjectBar}
                    />
                  </div>
                ) : null}
                {timeScale === "week" ? (
                  <ScheduleWeekView
                    weekDates={weekDates}
                    onPrevWeek={() => setFocusDate((p) => addDaysToIso(p, -7))}
                    onNextWeek={() => setFocusDate((p) => addDaysToIso(p, 7))}
                    onToday={goToday}
                    shifts={displayShiftsForGrid}
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
                      setTimeScale("day");
                    }}
                    projectBarItems={showProjectOverlay ? projectBarItems : null}
                    scheduleDragLock={scheduleDragLock}
                    dragSession={dragSession}
                    calendarDropsDisabled={calendarDropsDisabled}
                    shiftDragEnabled={shiftDragEnabled}
                    workerHighlightByDate={workerHighlightMap}
                    workerDropPlacementWindow={placementDropWindow}
                    onWorkerDropRejected={(msg) => setScheduleToast(msg)}
                    onShiftDragSessionStart={setDragSession}
                    onShiftDragSessionEnd={() => {
                      setDragSession(null);
                      setTrashHovering(false);
                    }}
                    onOpenWorkerAttendance={
                      canPublishSchedule ? (p) => setWorkerAttendanceModal(p) : undefined
                    }
                    onPaletteDrop={handlePaletteDrop}
                  />
                ) : null}
                {timeScale === "month" ? (
                  <ScheduleCalendarGrid
                    year={cursor.y}
                    monthIndex={cursor.m}
                    onPrevMonth={prevMonth}
                    onNextMonth={nextMonth}
                    shifts={displayShiftsForGrid}
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
                      setTimeScale("day");
                    }}
                    projectBarItems={showProjectOverlay ? projectBarItems : null}
                    scheduleDragLock={scheduleDragLock}
                    dragSession={dragSession}
                    calendarDropsDisabled={calendarDropsDisabled}
                    shiftDragEnabled={shiftDragEnabled}
                    workerHighlightByDate={workerHighlightMap}
                    workerDropPlacementWindow={placementDropWindow}
                    onWorkerDropRejected={(msg) => setScheduleToast(msg)}
                    onShiftDragSessionStart={setDragSession}
                    onShiftDragSessionEnd={() => {
                      setDragSession(null);
                      setTrashHovering(false);
                    }}
                    onOpenWorkerAttendance={
                      canPublishSchedule ? (p) => setWorkerAttendanceModal(p) : undefined
                    }
                    onPaletteDrop={handlePaletteDrop}
                  />
                ) : null}
                      </div>
                    </section>
                  </div>
                </div>
              </>
            ) : null}
          {workspaceView === "my-shifts" ? (
            <ScheduleMyShiftsView
              shifts={myShifts}
              workers={workers}
              currentUserId={currentUserId}
              settings={settings}
              onSelectShift={openEdit}
            />
          ) : null}
          {workspaceView === "personnel" ? (
            <SchedulePersonnel
              workers={workers}
              shifts={shifts}
              roles={roles}
              year={metricsMonth.y}
              monthIndex={metricsMonth.m}
              scheduleDragLocked={scheduleDragLock}
            />
          ) : null}
          {workspaceView === "reports" ? <ScheduleReports /> : null}
          </div>
      </div>

      {workerAttendanceModal ? (
        <WorkerAttendanceModal
          open
          onClose={() => setWorkerAttendanceModal(null)}
          workerId={workerAttendanceModal.workerId}
          date={workerAttendanceModal.date}
          workerLabel={workerAttendanceModal.label}
        />
      ) : null}

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

      <SchedulePeriodModal
        open={showPeriodModal}
        existing={activePeriod}
        onClose={() => setShowPeriodModal(false)}
        onSaved={() => {
          void reloadActivePeriod();
        }}
      />

      <TimeOffRequestModal
        open={timeOffOpen}
        workers={workers}
        onClose={() => setTimeOffOpen(false)}
        onSubmit={(p) => addTimeOffBlock(p)}
      />

      <AvailabilitySupervisorDrawer
        open={availabilitySupervisorOpen}
        onClose={() => setAvailabilitySupervisorOpen(false)}
        workers={workers}
        periodLabel={activePeriod ? `${activePeriod.start_date} – ${activePeriod.end_date}` : null}
        onMatrixChanged={() => setAvailabilityMatrixVersion((v) => v + 1)}
        onNotify={(msg) => setScheduleToast(msg)}
      />

      <EmployeeAvailabilityDrawer
        open={employeeAvailabilityOpen}
        onClose={() => setEmployeeAvailabilityOpen(false)}
        workers={workers}
        setWorkers={setWorkers}
      />

      <AvailabilityOverrideModal
        open={availabilityOverride !== null}
        workerName={workers.find((x) => x.id === availabilityOverride?.workerId)?.name ?? ""}
        detail={availabilityOverride?.detail ?? ""}
        onCancel={() => setAvailabilityOverride(null)}
        onConfirm={(reason) => {
          if (!availabilityOverride) return;
          if (availabilityOverride.kind === "worker") {
            handleWorkerDrop(availabilityOverride.workerId, availabilityOverride.date, reason);
          } else {
            commitPaletteShiftAssignment(
              availabilityOverride.workerId,
              availabilityOverride.date,
              availabilityOverride.code,
              reason,
            );
          }
          setAvailabilityOverride(null);
        }}
      />

      {scheduleToast ? (
        <div
          className="pointer-events-none fixed bottom-36 left-1/2 z-[150] max-w-md -translate-x-1/2 rounded-md border border-amber-400/50 bg-amber-50 px-4 py-2.5 text-center text-sm font-medium text-amber-950 shadow-lg dark:border-amber-500/40 dark:bg-amber-950/90 dark:text-amber-50 sm:bottom-40"
          role="status"
        >
          {scheduleToast}
        </div>
      ) : null}
    </div>
  );
}
