"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ClipboardList } from "lucide-react";
import { PulseDrawer } from "@/components/schedule/PulseDrawer";
import { TimeOffApprovalQueue } from "@/components/schedule/time-off/TimeOffApprovalQueue";
import { TimeOffRequestHistory } from "@/components/schedule/time-off/TimeOffRequestHistory";
import { TimeOffSchedulingCalendar } from "@/components/schedule/time-off/TimeOffSchedulingCalendar";
import { assessSelectionWarnings } from "@/lib/schedule/time-off-calendar";
import { eachDayInRange, sortIsoDates, TIME_OFF_REQUEST_KINDS } from "@/lib/schedule/time-off-request";
import type { ProjectScheduleOverlayMeta } from "@/lib/schedule/project-overlay-styles";
import type {
  ScheduleSettings,
  Shift,
  TimeOffBlock,
  TimeOffRequestKind,
  Worker,
} from "@/lib/schedule/types";
import { getServerDate } from "@/lib/serverTime";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

type Props = {
  open: boolean;
  onClose: () => void;
  workers: Worker[];
  shifts: Shift[];
  settings: ScheduleSettings;
  projects: readonly ProjectScheduleOverlayMeta[];
  timeOffBlocks: TimeOffBlock[];
  currentUserId: string | null;
  currentUserName: string;
  isSupervisor: boolean;
  showConflictHints?: boolean;
  onSubmitRequest: (payload: { workerId: string; dates: string[]; kind: TimeOffRequestKind; note?: string }) => void;
  onReviewRequest: (id: string, status: "approved" | "denied" | "needs_review") => void;
};

type SupervisorTab = "queue" | "request";

export function TimeOffOperationsDrawer({
  open,
  onClose,
  workers,
  shifts,
  settings,
  projects,
  timeOffBlocks,
  currentUserId,
  currentUserName,
  isSupervisor,
  showConflictHints = true,
  onSubmitRequest,
  onReviewRequest,
}: Props) {
  const now = getServerDate();
  const [supervisorTab, setSupervisorTab] = useState<SupervisorTab>(isSupervisor ? "queue" : "request");
  const [calendarMonth, setCalendarMonth] = useState({ year: now.getFullYear(), monthIndex: now.getMonth() });
  const [dateMode, setDateMode] = useState<"pick" | "range">("pick");
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);
  const [kind, setKind] = useState<TimeOffRequestKind>("vacation");
  const [note, setNote] = useState("");
  const [onBehalfWorkerId, setOnBehalfWorkerId] = useState("");

  const resolvedWorkerId = isSupervisor && onBehalfWorkerId ? onBehalfWorkerId : currentUserId ?? "";
  const resolvedWorkerName = useMemo(() => {
    if (isSupervisor && onBehalfWorkerId) {
      return workers.find((w) => w.id === onBehalfWorkerId)?.name ?? "Selected worker";
    }
    const match = workers.find((w) => w.id === currentUserId);
    return match?.name ?? currentUserName;
  }, [isSupervisor, onBehalfWorkerId, workers, currentUserId, currentUserName]);

  useEffect(() => {
    if (!open) return;
    setSelectedDates(new Set());
    setRangeStart("");
    setRangeEnd("");
    setRangeAnchor(null);
    setNote("");
    setKind("vacation");
    setOnBehalfWorkerId("");
    setSupervisorTab(isSupervisor ? "queue" : "request");
  }, [open, isSupervisor]);

  const selectedList = useMemo(() => sortIsoDates([...selectedDates]), [selectedDates]);

  const warnings = useMemo(() => {
    if (!showConflictHints || !resolvedWorkerId || !selectedList.length) return [];
    return assessSelectionWarnings(
      resolvedWorkerId,
      selectedList,
      projects,
      shifts,
      workers,
      settings,
      timeOffBlocks,
    );
  }, [
    showConflictHints,
    resolvedWorkerId,
    selectedList,
    projects,
    shifts,
    workers,
    settings,
    timeOffBlocks,
  ]);

  const toggleDate = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const addRangeFromInputs = () => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return;
    const added = eachDayInRange(rangeStart, rangeEnd);
    setSelectedDates((prev) => new Set([...prev, ...added]));
    setRangeStart("");
    setRangeEnd("");
  };

  const applyCalendarRange = (start: string, end: string) => {
    const [a, b] = start <= end ? [start, end] : [end, start];
    const added = eachDayInRange(a, b);
    setSelectedDates((prev) => new Set([...prev, ...added]));
    setRangeAnchor(null);
  };

  const canSubmit = Boolean(resolvedWorkerId && selectedList.length);

  const requestPanel = (
    <div className="space-y-4">
      <div className="rounded-xl border border-pulseShell-border bg-gradient-to-br from-pulseShell-surface to-pulseShell-surface/40 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted">Request time off</p>
        <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100">
          For: <span className="text-pulse-accent">{resolvedWorkerName}</span>
        </p>
        {!isSupervisor ? (
          <p className="mt-1 text-xs text-pulse-muted">
            Your request will be submitted as <span className="font-semibold">Pending</span> for manager review.
          </p>
        ) : null}
      </div>

      {isSupervisor ? (
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-on-behalf">
            Submit on behalf of (optional)
          </label>
          <select
            id="pto-on-behalf"
            className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm"
            value={onBehalfWorkerId}
            onChange={(e) => setOnBehalfWorkerId(e.target.value)}
          >
            <option value="">Yourself ({currentUserName})</option>
            {workers
              .filter((w) => w.active)
              .map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-kind">
          Request type
        </label>
        <select
          id="pto-kind"
          className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2.5 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as TimeOffRequestKind)}
        >
          {TIME_OFF_REQUEST_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg border px-2 py-2 text-xs font-semibold",
            dateMode === "pick"
              ? "border-pulse-accent/50 bg-pulse-accent/10 text-pulse-accent"
              : "border-pulseShell-border text-pulse-muted",
          )}
          onClick={() => {
            setDateMode("pick");
            setRangeAnchor(null);
          }}
        >
          Individual dates
        </button>
        <button
          type="button"
          className={cn(
            "flex-1 rounded-lg border px-2 py-2 text-xs font-semibold",
            dateMode === "range"
              ? "border-pulse-accent/50 bg-pulse-accent/10 text-pulse-accent"
              : "border-pulseShell-border text-pulse-muted",
          )}
          onClick={() => setDateMode("range")}
        >
          Date ranges
        </button>
      </div>

      {dateMode === "range" ? (
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <div>
            <label className="text-[10px] font-semibold uppercase text-pulse-muted">From</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-pulseShell-border bg-pulseShell-surface px-2 py-2 text-sm"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase text-pulse-muted">To</label>
            <input
              type="date"
              className="mt-1 w-full rounded-lg border border-pulseShell-border bg-pulseShell-surface px-2 py-2 text-sm"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="rounded-lg border border-pulseShell-border px-3 py-2 text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800"
            onClick={addRangeFromInputs}
          >
            Add
          </button>
        </div>
      ) : null}

      <TimeOffSchedulingCalendar
        year={calendarMonth.year}
        monthIndex={calendarMonth.monthIndex}
        onMonthChange={(year, monthIndex) => setCalendarMonth({ year, monthIndex })}
        workerId={resolvedWorkerId}
        selectedDates={selectedDates}
        onToggleDate={(date) => {
          if (dateMode === "pick") {
            toggleDate(date);
            return;
          }
          if (!rangeAnchor) {
            setRangeAnchor(date);
            return;
          }
          applyCalendarRange(rangeAnchor, date);
        }}
        shifts={shifts}
        workers={workers}
        settings={settings}
        timeOffBlocks={timeOffBlocks}
        projects={projects}
      />

      {dateMode === "range" ? (
        <p className="text-xs text-pulse-muted">
          {rangeAnchor
            ? "Select end date on the calendar."
            : "Click a start day, then an end day — or use the range fields above."}
        </p>
      ) : null}

      {selectedList.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedList.map((d) => (
            <button
              key={d}
              type="button"
              className="rounded-full border border-pulseShell-border bg-pulseShell-surface px-2 py-0.5 text-[11px] font-medium hover:border-rose-300 hover:text-rose-700"
              onClick={() => toggleDate(d)}
              title="Remove date"
            >
              {d} ×
            </button>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div
          role="status"
          className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-3 dark:border-amber-900/50 dark:bg-amber-950/40"
        >
          <div className="flex gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
            <ul className="space-y-1 text-xs text-amber-900/90 dark:text-amber-100/90">
              {warnings.map((w) => (
                <li key={`${w.code}-${w.message}`}>
                  <span className={w.severity === "critical" ? "font-semibold text-rose-800 dark:text-rose-300" : ""}>
                    {w.severity === "critical" ? "Critical: " : ""}
                  </span>
                  {w.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor="pto-note">
          Note (optional)
        </label>
        <textarea
          id="pto-note"
          rows={2}
          className="mt-1.5 w-full rounded-[10px] border border-pulseShell-border bg-pulseShell-surface px-3 py-2 text-sm"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Coverage notes, travel, etc."
        />
      </div>

      <TimeOffRequestHistory
        blocks={timeOffBlocks}
        workers={workers}
        workerId={isSupervisor && onBehalfWorkerId ? onBehalfWorkerId : currentUserId ?? undefined}
      />
    </div>
  );

  return (
    <PulseDrawer
      open={open}
      title={isSupervisor ? "Time off operations" : "Request time off"}
      subtitle={
        isSupervisor
          ? "Review staffing requests, approve or deny with schedule context."
          : "Schedule-aware request — select days, see conflicts, and track status."
      }
      onClose={onClose}
      placement="center"
      wide
      labelledBy="timeoff-ops-title"
      footer={
        supervisorTab === "request" || !isSupervisor ? (
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cn(buttonVariants({ surface: "light", intent: "accent" }), "px-5 py-2.5 disabled:opacity-40")}
              disabled={!canSubmit}
              onClick={() => {
                onSubmitRequest({
                  workerId: resolvedWorkerId,
                  dates: selectedList,
                  kind,
                  note: note.trim() || undefined,
                });
                onClose();
              }}
            >
              Submit request
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              type="button"
              className="text-sm font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )
      }
    >
      <div className="mx-auto max-w-2xl space-y-4">
        <h3 id="timeoff-ops-title" className="sr-only">
          Time off operations
        </h3>

        {isSupervisor ? (
          <div className="flex gap-1 rounded-xl border border-pulseShell-border bg-pulseShell-surface/60 p-1">
            <TabButton
              active={supervisorTab === "queue"}
              icon={ClipboardList}
              label="Approval queue"
              count={timeOffBlocks.filter((b) => b.status === "pending" || b.status === "needs_review").length}
              onClick={() => setSupervisorTab("queue")}
            />
            <TabButton
              active={supervisorTab === "request"}
              icon={CalendarDays}
              label="New request"
              onClick={() => setSupervisorTab("request")}
            />
          </div>
        ) : null}

        {isSupervisor && supervisorTab === "queue" ? (
          <TimeOffApprovalQueue
            blocks={timeOffBlocks}
            workers={workers}
            shifts={shifts}
            settings={settings}
            projects={projects}
            onApprove={(id) => onReviewRequest(id, "approved")}
            onDeny={(id) => onReviewRequest(id, "denied")}
            onNeedsReview={(id) => onReviewRequest(id, "needs_review")}
          />
        ) : (
          requestPanel
        )}
      </div>
    </PulseDrawer>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof CalendarDays;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-pulseShell-elevated text-gray-900 shadow-sm dark:text-gray-100"
          : "text-pulse-muted hover:text-gray-800 dark:hover:text-gray-200",
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count != null && count > 0 ? (
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-200">
          {count}
        </span>
      ) : null}
    </button>
  );
}
