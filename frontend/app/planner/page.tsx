"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Settings } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { DayCalendar } from "@/components/planner/DayCalendar";
import { PlannerChrome } from "@/components/planner/PlannerChrome";
import { PlannerSettingsModal } from "@/components/planner/PlannerSettingsModal";
import { clockFromMinutes, freeGaps, minutesFromClock } from "@/lib/planner/dayCalendar";
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
  isoDate,
  moveBlock,
  patchBlock,
  patchCategory,
  patchSettings,
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
  const occupied = day.timeline.map((block) => ({
    start: minutesFromClock(block.start_time),
    end: minutesFromClock(block.end_time),
  }));
  const gap = freeGaps(start, end, occupied)[0];
  if (!gap) return null;
  return { start: clockFromMinutes(gap.start), end: clockFromMinutes(Math.min(gap.end, gap.start + 60)) };
}

export default function PlannerTodayPage() {
  const [date, setDate] = useState(isoDate(new Date()));
  const [day, setDay] = useState<PlannerDay | null>(null);
  const [cats, setCats] = useState<PlannerCategory[]>([]);
  const [settings, setSettings] = useState<PlannerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState("");
  const [quickCat, setQuickCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emReason, setEmReason] = useState("emergency");
  const [emNotes, setEmNotes] = useState("");
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
      setError("Condense existing blocks to free a 15-minute gap, then add a new block.");
      return;
    }
    await run(async () => {
      await createBlock({
        date,
        start_time: gap.start,
        end_time: gap.end,
        title,
        category_id: quickCat || null,
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
        {error ? (
          <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
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
            </p>
          </div>
          <form onSubmit={onQuickAdd} data-tour="planner-quick-add" className="flex min-w-[16rem] flex-1 flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Add into a gap</span>
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

        {loading || !day ? (
          <p className="text-sm text-ds-muted">Loading…</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.7fr)]">
            <div className="space-y-3">
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
                onAdd={(start, end, title, categoryId) =>
                  run(() =>
                    createBlock({
                      date,
                      start_time: start,
                      end_time: end,
                      title,
                      category_id: categoryId,
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
                <p className="mt-1 text-xs text-ds-muted">Needs an open gap. Condense blocks first if the slot is full.</p>
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
                  <li>Completion: {day.completion_pct}%</li>
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
              <p className="mt-1 text-sm text-ds-muted">Pauses the current task and records the interruption.</p>
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
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" className={btnGhost} onClick={() => setEmergencyOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={btnDanger}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await startInterruption({ reason: emReason, notes: emNotes || undefined });
                      setEmergencyOpen(false);
                      setEmNotes("");
                    })
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
