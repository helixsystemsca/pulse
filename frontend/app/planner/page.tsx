"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlannerChrome } from "@/components/planner/PlannerChrome";
import {
  DELAY_REASON_LABELS,
  acceptDay,
  closeoutDay,
  completeTask,
  createCalendarEvent,
  createTask,
  deferTask,
  endInterruption,
  fetchCategories,
  fetchDay,
  generateDay,
  hhmm,
  isoDate,
  lockBlock,
  moveBlock,
  shiftIsoDate,
  startInterruption,
  startTask,
  stopTask,
  type PlannerBlock,
  type PlannerCategory,
  type PlannerDay,
} from "@/lib/planner/plannerService";

const inputClass =
  "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground outline-none focus:border-ds-primary";
const btnPrimary =
  "rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";
const btnGhost =
  "rounded-lg border border-ds-border px-3 py-1.5 text-sm text-ds-foreground hover:bg-ds-card";
const btnDanger =
  "rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-200";

function statusLabel(block: PlannerBlock, nowId: string | null, nextId: string | null): string {
  if (block.block_type === "meeting") return "Calendar";
  if (block.block_type === "interruption") return "Emergency";
  if (block.status === "complete") return "Complete";
  if (block.status === "in_progress" || block.id === nowId) return "In Progress";
  if (block.id === nextId) return "Next";
  if (block.block_type === "open") return "Open";
  return "Scheduled";
}

function minsLabel(n: number): string {
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

export default function PlannerTodayPage() {
  const [date, setDate] = useState(isoDate(new Date()));
  const [day, setDay] = useState<PlannerDay | null>(null);
  const [cats, setCats] = useState<PlannerCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quick, setQuick] = useState("");
  const [quickCat, setQuickCat] = useState("");
  const [busy, setBusy] = useState(false);
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
    setLoading(true);
    setError(null);
    try {
      const [d, c] = await Promise.all([fetchDay(date), fetchCategories()]);
      setDay(d);
      setCats(c);
      setQuickCat((prev) => prev || c[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load planner");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const nowId = day?.now?.id ?? null;
  const nextId = day?.next?.id ?? null;

  const atRiskIds = useMemo(() => new Set(day?.at_risk.map((t) => t.id) ?? []), [day]);

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
    if (!title) return;
    await run(async () => {
      await createTask({ title, category_id: quickCat || undefined, estimated_minutes: 30, priority: "medium" });
      await generateDay(date);
      setQuick("");
    });
  }

  async function onDropBlock(target: PlannerBlock, draggedId: string) {
    if (draggedId === target.id) return;
    await run(() => moveBlock(draggedId, hhmm(target.start_time)));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Operations Planner"
        description="The system plans the day. You stay in control."
        icon={CalendarDays}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnDanger} disabled={busy} onClick={() => setEmergencyOpen(true)}>
              Emergency / Interruption
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(() => generateDay(date))}>
              Regenerate
            </button>
            <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(() => acceptDay(date))}>
              Accept schedule
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
          <div>
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
          <form onSubmit={onQuickAdd} className="flex min-w-[16rem] flex-1 flex-wrap items-end gap-2">
            <label className="min-w-[12rem] flex-1">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ds-muted">Capture</span>
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
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
            <div className="space-y-3">
              <section className="rounded-xl border border-ds-border bg-ds-card p-4 shadow-[var(--ds-shadow-card)]">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Now</p>
                {day.now ? (
                  <div className="mt-2">
                    <p className="text-xs uppercase tracking-wide" style={{ color: day.now.category_color ?? undefined }}>
                      {day.now.category_name ?? day.now.block_type}
                    </p>
                    <h2 className="text-xl font-semibold text-ds-foreground">{day.now.title}</h2>
                    <p className="mt-1 text-sm text-ds-muted">
                      {hhmm(day.now.start_time)}–{hhmm(day.now.end_time)}
                      {day.now.priority ? ` · ${day.now.priority}` : ""}
                      {day.now.delay_count ? ` · delayed ${day.now.delay_count}×` : ""}
                    </p>
                    {day.now.task_id ? (
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
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-ds-muted">Nothing scheduled for this moment. Capture work or regenerate the day.</p>
                )}
              </section>

              <section className="rounded-xl border border-ds-border bg-ds-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Timeline</p>
                <ol className="mt-3 space-y-2">
                  {day.timeline.map((b) => {
                    const isNow = b.id === nowId;
                    const isNext = b.id === nextId;
                    const atRisk = Boolean(b.task_id && atRiskIds.has(b.task_id));
                    return (
                      <li
                        key={b.id}
                        draggable={b.block_type === "task"}
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", b.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData("text/plain");
                          if (id) void onDropBlock(b, id);
                        }}
                        className={`rounded-lg border px-3 py-2 ${
                          b.block_type === "meeting"
                            ? "border-slate-400 bg-slate-100 dark:bg-slate-900/50"
                            : b.block_type === "interruption"
                              ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                              : isNow
                                ? "border-ds-primary bg-ds-secondary"
                                : "border-ds-border bg-ds-bg"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-medium text-ds-muted">
                              {hhmm(b.start_time)}–{hhmm(b.end_time)}
                            </p>
                            <p className="text-[11px] uppercase tracking-wide" style={{ color: b.category_color ?? undefined }}>
                              {b.category_name ?? b.block_type}
                            </p>
                            <p className="font-medium text-ds-foreground">{b.title}</p>
                            <p className="text-xs text-ds-muted">
                              {b.priority ? `${b.priority} · ` : ""}
                              {b.estimated_minutes ? `${b.estimated_minutes} min · ` : ""}
                              {b.source_type ?? "routine"}
                              {b.delay_count ? ` · delayed ${b.delay_count}×` : ""}
                              {b.delay_reason ? ` (${DELAY_REASON_LABELS[b.delay_reason] ?? b.delay_reason})` : ""}
                              {atRisk ? " · at risk" : ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="rounded-full border border-ds-border px-2 py-0.5 text-[11px] uppercase tracking-wide text-ds-muted">
                              {statusLabel(b, nowId, nextId)}
                            </span>
                            {b.task_id ? (
                              <div className="flex flex-wrap justify-end gap-1">
                                {isNext || isNow ? (
                                  <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(() => startTask(b.task_id!))}>
                                    Start
                                  </button>
                                ) : null}
                                <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(() => completeTask(b.task_id!))}>
                                  Done
                                </button>
                                <button type="button" className={btnGhost} disabled={busy} onClick={() => void run(() => lockBlock(b.id, !b.locked))}>
                                  {b.locked ? "Unlock" : "Lock"}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>

            <aside className="space-y-3">
              <section className="rounded-xl border border-ds-border bg-ds-card p-4">
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

              <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:bg-amber-950/20">
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

              <section className="rounded-xl border border-ds-border bg-ds-card p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Add meeting (internal calendar)</p>
                <p className="mt-1 text-xs text-ds-muted">Outlook/Google connectors are not connected. This uses the internal provider.</p>
                <div className="mt-2 space-y-2">
                  <input className={inputClass} placeholder="Capital projects meeting" value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputClass} type="time" value={meetingStart} onChange={(e) => setMeetingStart(e.target.value)} />
                    <input className={inputClass} type="time" value={meetingEnd} onChange={(e) => setMeetingEnd(e.target.value)} />
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

              <section className="rounded-xl border border-ds-border bg-ds-card p-4">
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
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-ds-muted">Why work was delayed</p>
                {Object.keys(day.metrics.delay_reasons || {}).length === 0 ? (
                  <p className="text-sm text-ds-muted">No delays recorded today.</p>
                ) : (
                  <ul className="mt-1 text-sm">
                    {Object.entries(day.metrics.delay_reasons).map(([k, v]) => (
                      <li key={k}>
                        {DELAY_REASON_LABELS[k] ?? k}: {v}
                      </li>
                    ))}
                  </ul>
                )}
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

        {emergencyOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-xl border border-ds-border bg-ds-card p-4 shadow-xl">
              <h3 className="text-lg font-semibold">Emergency / Interruption</h3>
              <p className="mt-1 text-sm text-ds-muted">Pauses the current task, records the interruption, then rebuilds the rest of the day when you resume.</p>
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
