"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Settings } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { DayCalendar } from "@/components/planner/DayCalendar";
import { PlannerChrome, PlannerToast } from "@/components/planner/PlannerChrome";
import { PlannerSettingsModal } from "@/components/planner/PlannerSettingsModal";
import { clockFromMinutes, freeGaps, isCapacityBlock, minutesFromClock } from "@/lib/planner/dayCalendar";
import {
  DELAY_REASON_LABELS,
  closeoutDay,
  completeTask,
  createBlock,
  createCalendarEvent,
  deferTask,
  deleteBlock,
  endInterruption,
  fetchCategories,
  fetchDay,
  fetchSettings,
  generateDay,
  hhmm,
  moveBlock,
  patchBlock,
  patchCategory,
  patchSettings,
  plannerToday,
  shiftIsoDate,
  startInterruption,
  startTask,
  stopTask,
  type PlannerCategory,
  type PlannerDay,
  type PlannerSettings,
} from "@/lib/planner/plannerService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";
const btnDanger =
  "rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-200";

function minsLabel(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

function firstGap(day: PlannerDay): { start: string; end: string } | null {
  const start = minutesFromClock(day.work_start);
  const end = minutesFromClock(day.work_end);
  const occupied = day.timeline
    .filter((block) => !isCapacityBlock(block))
    .map((block) => ({
      start: minutesFromClock(block.start_time),
      end: minutesFromClock(block.end_time),
    }));
  const gap = freeGaps(start, end, occupied)[0];
  if (!gap) return null;
  return { start: clockFromMinutes(gap.start), end: clockFromMinutes(Math.min(gap.end, gap.start + 60)) };
}

function hasOpenCapacity(day: PlannerDay): boolean {
  return day.timeline.some((block) => isCapacityBlock(block));
}

export default function PlannerTodayPage() {
  const [date, setDate] = useState(plannerToday());
  const [day, setDay] = useState<PlannerDay | null>(null);
  const [cats, setCats] = useState<PlannerCategory[]>([]);
  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [quick, setQuick] = useState("");
  const [quickCat, setQuickCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emReason, setEmReason] = useState("emergency");
  const [emNotes, setEmNotes] = useState("");
  const [emCreateWr, setEmCreateWr] = useState(false);
  const [emDuration, setEmDuration] = useState("workday");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingStart, setMeetingStart] = useState("08:30");
  const [meetingEnd, setMeetingEnd] = useState("09:00");
  const [closeNotes, setCloseNotes] = useState("");
  const [deferId, setDeferId] = useState<string | null>(null);
  const [deferReason, setDeferReason] = useState("personal_manual");

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [d, c, s] = await Promise.all([fetchDay(date), fetchCategories(), fetchSettings()]);
      setDay(d);
      setCats(c);
      setSettings(s);
      setQuickCat((prev) => prev || c[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load planner");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const nowId = day?.now?.id ?? null;
  const nextId = day?.next?.id ?? null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function onQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    const title = quick.trim();
    if (!title || !day) return;
    const gap = firstGap(day);
    if (!gap) {
      setError("No Open capacity left. Shorten a planned block to make 15 minutes, then add work.");
      return;
    }
    await run(async () => {
      await createBlock({
        date,
        start_time: gap.start,
        end_time: gap.end,
        title,
        category_id: quickCat || null,
        block_type: "task",
      });
      setQuick("");
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Operations Planner"
        description="8:30–4:30 hour template. Drag and resize in 15-minute steps."
        icon={CalendarDays}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} disabled={busy} data-tour="planner-settings" onClick={() => setSettingsOpen(true)}>
              <span className="inline-flex items-center gap-1">
                <Settings className="h-4 w-4" />
                Settings
              </span>
            </button>
            <button type="button" className={btnDanger} disabled={busy} data-tour="planner-emergency" onClick={() => setEmergencyOpen(true)}>
              Emergency / Interruption
            </button>
            <button type="button" className={btnGhost} disabled={busy} data-tour="planner-reset" onClick={() => void run(() => generateDay(date))}>
              Reset hour template
            </button>
          </div>
        }
      />
      <PageBody>
        <PlannerChrome />
        <PlannerToast message={toast} />
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            <p>{error}</p>
            <button type="button" className={`${btnGhost} mt-2`} onClick={() => void reload()}>
              Retry
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div data-tour="planner-date">
            <p className="text-xs font-medium uppercase tracking-wide text-ds-muted">Today</p>
            <div className="mt-1 flex items-center gap-2">
              <button type="button" className={btnGhost} onClick={() => setDate(shiftIsoDate(date, -1))}>
                ←
              </button>
              <input className={inputClass + " w-auto"} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button type="button" className={btnGhost} onClick={() => setDate(shiftIsoDate(date, 1))}>
                →
              </button>
            </div>
            <p className="mt-1 text-sm text-ds-muted">
              {day?.day_label} · {hhmm(day?.work_start)}–{hhmm(day?.work_end)} · {day?.completion_pct ?? 0}% complete
              {day && day.timeline.length > 0 && day.timeline.every((block) => isCapacityBlock(block))
                ? " — Open is unused capacity, not unfinished work"
                : ""}
            </p>
          </div>
          <form onSubmit={onQuickAdd} data-tour="planner-quick-add" className="flex min-w-[16rem] flex-1 flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Add into Open capacity</span>
              <input
                className={inputClass}
                placeholder="Review ammonia plant inspection report"
                value={quick}
                onChange={(e) => setQuick(e.target.value)}
              />
            </label>
            <select className={inputClass + " w-44"} value={quickCat} onChange={(e) => setQuickCat(e.target.value)}>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className={btnPrimary} disabled={busy || !quick.trim()}>
              Add
            </button>
          </form>
        </div>

        {day?.open_interruption ? (
          <div className="rounded-xl border border-red-400 bg-red-50 p-4 dark:bg-red-950/30">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200">
              Interruption in progress — {DELAY_REASON_LABELS[day.open_interruption.reason] ?? day.open_interruption.reason}
            </p>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{day.open_interruption.notes}</p>
            <button
              type="button"
              className={`${btnPrimary} mt-3`}
              disabled={busy}
              onClick={() => void run(() => endInterruption(day.open_interruption!.id))}
            >
              Resume previous work
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : !day ? (
          <div className="rounded-xl border border-ds-border bg-ds-card p-4">
            <p className="text-sm text-ds-foreground">This day could not be loaded.</p>
            <p className="mt-1 text-sm text-ds-muted">Check your connection, then retry. If it is empty, start the hour template.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className={btnPrimary} onClick={() => void reload()}>
                Retry
              </button>
              <button type="button" className={btnGhost} onClick={() => void run(() => generateDay(date))}>
                Start hour template
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
            <div className="space-y-3">
              {day.timeline.length === 0 ? (
                <div className="rounded-xl border border-ds-border bg-ds-card p-4">
                  <p className="font-medium text-ds-foreground">No blocks on this day yet.</p>
                  <p className="mt-1 text-sm text-ds-muted">
                    Start the 8:30–4:30 hour template (Open capacity), then add work or place inbox tasks.
                  </p>
                  <button type="button" className={`${btnPrimary} mt-3`} disabled={busy} onClick={() => void run(() => generateDay(date))}>
                    Start hour template
                  </button>
                </div>
              ) : hasOpenCapacity(day) ? (
                <p className="rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm text-ds-muted">
                  Open blocks are unused capacity. Quick-add, + Add block, or Inbox → Place on today will fill them without resetting the day.
                </p>
              ) : !firstGap(day) ? (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                  The day is full. Shorten a planned block to make 15 minutes of Open capacity, then add work.
                </p>
              ) : null}
              <div data-tour="planner-calendar">
              <DayCalendar
                date={date}
                workStart={day.work_start}
                workEnd={day.work_end}
                blocks={day.timeline}
                categories={cats}
                nowId={nowId}
                nextId={nextId}
                disabled={busy}
                onMove={(id, start, end) => run(() => moveBlock(id, start, end))}
                onConflict={(message) => setToast(message)}
                onAdd={(start, end, title, categoryId) =>
                  run(() =>
                    createBlock({
                      date,
                      start_time: start,
                      end_time: end,
                      title,
                      category_id: categoryId,
                      block_type: title.trim() && title.trim().toLowerCase() !== "open" ? "task" : "open",
                    }),
                  )
                }
                onPatch={(id, body) => run(() => patchBlock(id, body))}
                onDelete={(id) => run(() => deleteBlock(id))}
              />
              </div>

              {day.now?.task_id ? (
                <section className="rounded-xl border border-ds-border bg-ds-card p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Current task</p>
                  <p className="mt-1 font-medium text-ds-foreground">{day.now.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btnPrimary} disabled={busy} onClick={() => void run(() => startTask(day.now!.task_id!))}>
                      Start task
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(() => stopTask(day.now!.task_id!))}>
                      Stop timer
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(() => completeTask(day.now!.task_id!))}>
                      Complete
                    </button>
                    <button type="button" className={btnGhost} disabled={busy} onClick={() => setDeferId(day.now!.task_id)}>
                      Defer
                    </button>
                  </div>
                </section>
              ) : null}
            </div>

            <aside className="space-y-3">
              <section data-tour="planner-now" className="rounded-xl border border-ds-border bg-ds-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Now</p>
                {day.now ? (
                  <div className="mt-2">
                    <p className="text-xs uppercase tracking-wide" style={{ color: day.now.category_color ?? undefined }}>
                      {day.now.category_name ?? day.now.block_type}
                    </p>
                    <p className="font-medium text-ds-foreground">{day.now.title}</p>
                    <p className="text-sm text-ds-muted">
                      {hhmm(day.now.start_time)}–{hhmm(day.now.end_time)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ds-muted">Nothing in this slot right now.</p>
                )}
              </section>

              <section data-tour="planner-next" className="rounded-xl border border-ds-border bg-ds-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Next</p>
                {day.next ? (
                  <div className="mt-2">
                    <p className="font-medium text-ds-foreground">{day.next.title}</p>
                    <p className="text-sm text-ds-muted">
                      {hhmm(day.next.start_time)}–{hhmm(day.next.end_time)}
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ds-muted">No later block today.</p>
                )}
              </section>

              <section data-tour="planner-at-risk" className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">At risk of not getting done</p>
                {day.at_risk.length === 0 ? (
                  <p className="mt-2 text-sm text-ds-muted">Nothing overdue or repeatedly deferred.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {day.at_risk.map((t) => (
                      <li key={t.id} className="text-sm">
                        <span className="font-medium text-ds-foreground">{t.title}</span>
                        <span className="block text-xs text-ds-muted">
                          {t.priority} · {t.category_name}
                          {t.due_date ? ` · due ${t.due_date}` : ""}
                          {t.delay_count ? ` · delayed ${t.delay_count}×` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section data-tour="planner-meeting" className="rounded-xl border border-ds-border bg-ds-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Add meeting (internal calendar)</p>
                <p className="mt-1 text-xs text-ds-muted">Inserts into Open capacity. Locked on the calendar so it cannot be dragged.</p>
                <div className="mt-2 space-y-2">
                  <input className={inputClass} placeholder="Capital projects meeting" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} type="time" step={900} value={meetingStart} onChange={(e) => setMeetingStart(e.target.value)} />
                    <input className={inputClass} type="time" step={900} value={meetingEnd} onChange={(e) => setMeetingEnd(e.target.value)} />
                  </div>
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={busy || !meetingTitle.trim()}
                    onClick={() =>
                      void run(async () => {
                        await createCalendarEvent({
                          title: meetingTitle.trim(),
                          start_at: `${date}T${meetingStart}:00`,
                          end_at: `${date}T${meetingEnd}:00`,
                        });
                        setMeetingTitle("");
                      })
                    }
                  >
                    Insert meeting
                  </button>
                </div>
              </section>

              <section data-tour="planner-closeout" className="rounded-xl border border-ds-border bg-ds-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Daily review</p>
                <ul className="mt-2 space-y-1 text-sm text-ds-foreground">
                  <li>Completed: {day.metrics.completed_count}</li>
                  <li>Completion: {day.completion_pct}% of planned work (task blocks — Open, meetings, and interruptions do not count)</li>
                  <li>Delayed: {day.metrics.delayed_count}</li>
                  <li>Blocked: {day.metrics.blocked_count}</li>
                  <li>Reactive interruptions: {minsLabel(day.metrics.interruption_minutes)}</li>
                  <li>Meetings: {minsLabel(day.metrics.meeting_minutes)}</li>
                  <li>Strategic/improvement: {minsLabel(day.metrics.strategic_minutes)}</li>
                </ul>
                <textarea
                  className={`${inputClass} mt-3`}
                  rows={2}
                  placeholder="Majority of afternoon lost to refrigeration contractor issue."
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                />
                <button type="button" className={`${btnGhost} mt-2`} disabled={busy} onClick={() => void run(() => closeoutDay(closeNotes, date))}>
                  Save closeout notes
                </button>
              </section>
            </aside>
          </div>
        )}

        <PlannerSettingsModal
          open={settingsOpen}
          settings={settings}
          categories={cats}
          busy={busy}
          onClose={() => setSettingsOpen(false)}
          onSaveHours={(workStart, workEnd) =>
            run(async () => {
              const updated = await patchSettings({ work_start: workStart, work_end: workEnd });
              setSettings(updated);
            })
          }
          onSaveColor={(categoryId, color) =>
            run(async () => {
              const updated = await patchCategory(categoryId, { color });
              setCats((prev) => prev.map((cat) => (cat.id === updated.id ? updated : cat)));
            })
          }
        />

        {emergencyOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-ds-border bg-ds-card p-4 shadow-xl">
              <h3 className="text-lg font-semibold">Emergency / Interruption</h3>
              <p className="mt-1 text-sm text-ds-muted">Pauses the current task and records the interruption. Does not count as poor performance.</p>
              <a href="/recreation/emergency" className="mt-2 inline-block text-sm font-medium text-ds-primary hover:underline">
                Open Emergency Response
              </a>
              <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ds-muted">Reason</label>
              <select className={inputClass} value={emReason} onChange={(e) => setEmReason(e.target.value)}>
                {Object.entries(DELAY_REASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ds-muted">Notes</label>
              <input className={inputClass} value={emNotes} onChange={(e) => setEmNotes(e.target.value)} placeholder="Pool chemical issue" />
              <label className="mt-3 block text-xs font-medium uppercase tracking-wide text-ds-muted">Duration</label>
              <select className={inputClass} value={emDuration} onChange={(e) => setEmDuration(e.target.value)}>
                <option value="workday">Until end of workday</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">90 minutes</option>
                <option value="120">2 hours</option>
              </select>
              <label className="mt-3 flex items-start gap-2 text-sm text-ds-foreground">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={emCreateWr}
                  onChange={(e) => setEmCreateWr(e.target.checked)}
                />
                <span>Create a work request for this interruption (continues even if work-request create fails)</span>
              </label>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className={btnGhost} onClick={() => setEmergencyOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        const duration_minutes = emDuration === "workday" ? undefined : Number(emDuration);
                        const row = await startInterruption({
                          reason: emReason,
                          notes: emNotes || undefined,
                          create_work_request: emCreateWr,
                          duration_minutes,
                        });
                        setEmergencyOpen(false);
                        setEmNotes("");
                        setEmCreateWr(false);
                        setEmDuration("workday");
                        await reload();
                        if (row.work_request_warning) setError(row.work_request_warning);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Action failed");
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  Start interruption
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {deferId ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-ds-border bg-ds-card p-4 shadow-xl">
              <h3 className="text-lg font-semibold">Defer task</h3>
              <select className={`${inputClass} mt-3`} value={deferReason} onChange={(e) => setDeferReason(e.target.value)}>
                {Object.entries(DELAY_REASON_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className={btnGhost} onClick={() => setDeferId(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await deferTask(deferId, deferReason);
                      setDeferId(null);
                    })
                  }
                >
                  Defer
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </PageBody>
    </div>
  );
}
