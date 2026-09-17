"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PlannerBlock, PlannerCategory } from "@/lib/planner/plannerService";
import { hhmm } from "@/lib/planner/plannerService";
import {
  PX_PER_MINUTE,
  SNAP_MINUTES,
  applyResize,
  clockFromMinutes,
  contrastText,
  freeGaps,
  isCapacityBlock,
  isImmovableBlock,
  minutesFromClock,
  nearestValidRange,
  snapMinutes,
  ticks,
  type MinuteRange,
} from "@/lib/planner/dayCalendar";

type DragMode = "move" | "resize-start" | "resize-end";

type DragState = {
  id: string;
  mode: DragMode;
  originY: number;
  original: MinuteRange;
};

type AddDraft = {
  start: number;
  end: number;
  title: string;
  categoryId: string;
};

function rangeOf(block: PlannerBlock): MinuteRange {
  return { start: minutesFromClock(block.start_time), end: minutesFromClock(block.end_time) };
}

function othersOf(blocks: PlannerBlock[], id: string): MinuteRange[] {
  return blocks.filter((block) => block.id !== id).map(rangeOf);
}

export function DayCalendar({
  date,
  workStart,
  workEnd,
  blocks,
  categories,
  nowId,
  nextId,
  disabled,
  onMove,
  onAdd,
  onPatch,
  onDelete,
}: {
  date: string;
  workStart: string;
  workEnd: string;
  blocks: PlannerBlock[];
  categories: PlannerCategory[];
  nowId?: string | null;
  nextId?: string | null;
  disabled?: boolean;
  onMove: (id: string, start: string, end: string) => Promise<void> | void;
  onAdd: (start: string, end: string, title: string, categoryId: string | null) => Promise<void> | void;
  onPatch: (id: string, body: { title?: string; category_id?: string | null }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [local, setLocal] = useState(blocks);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState<AddDraft | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  const localRef = useRef(blocks);
  const applyDragRef = useRef<(clientY: number) => void>(() => undefined);
  const finishDragRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (!dragRef.current) {
      setLocal(blocks);
      localRef.current = blocks;
    }
  }, [blocks]);

  const workA = minutesFromClock(workStart);
  const workB = minutesFromClock(workEnd);
  const viewStart = Math.min(workA, ...local.map((block) => rangeOf(block).start), workA);
  const viewEnd = Math.max(workB, ...local.map((block) => rangeOf(block).end), workB);
  const height = Math.max(PX_PER_MINUTE * (viewEnd - viewStart), 120);
  const gaps = useMemo(
    () => freeGaps(workA, workB, local.filter((block) => !isCapacityBlock(block)).map(rangeOf)),
    [local, workA, workB],
  );

  const todayIso = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  }, []);
  const nowMin = useMemo(() => {
    if (date !== todayIso) return null;
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  }, [date, todayIso]);

  function applyDrag(clientY: number) {
    const drag = dragRef.current;
    if (!drag) return;
    const delta = snapMinutes((clientY - drag.originY) / PX_PER_MINUTE);
    setLocal((current) => {
      const occupied = othersOf(current, drag.id);
      let nextRange: MinuteRange | null = null;
      if (drag.mode === "move") {
        nextRange = nearestValidRange(
          drag.original.start + delta,
          drag.original.end - drag.original.start,
          workA,
          workB,
          occupied,
        );
      } else if (drag.mode === "resize-start") {
        nextRange = applyResize(
          drag.original,
          { start: drag.original.start + delta, end: drag.original.end },
          "start",
          workA,
          workB,
          occupied,
        );
      } else {
        nextRange = applyResize(
          drag.original,
          { start: drag.original.start, end: drag.original.end + delta },
          "end",
          workA,
          workB,
          occupied,
        );
      }
      if (!nextRange) return current;
      if (nextRange.start !== drag.original.start || nextRange.end !== drag.original.end) {
        movedRef.current = true;
      }
      const next = current.map((block) =>
        block.id === drag.id
          ? { ...block, start_time: clockFromMinutes(nextRange.start), end_time: clockFromMinutes(nextRange.end) }
          : block,
      );
      localRef.current = next;
      return next;
    });
  }

  async function finishDrag() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const block = localRef.current.find((row) => row.id === drag.id);
    if (!block) return;
    const next = rangeOf(block);
    if (next.start === drag.original.start && next.end === drag.original.end) return;
    await onMove(block.id, clockFromMinutes(next.start), clockFromMinutes(next.end));
  }
  applyDragRef.current = applyDrag;
  finishDragRef.current = finishDrag;

  useEffect(() => {
    function onMovePtr(e: PointerEvent) {
      if (!dragRef.current) return;
      applyDragRef.current(e.clientY);
    }
    function onUp() {
      if (!dragRef.current) return;
      void finishDragRef.current();
    }
    window.addEventListener("pointermove", onMovePtr);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMovePtr);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  function startDrag(e: React.PointerEvent, block: PlannerBlock, mode: DragMode) {
    if (disabled || isImmovableBlock(block)) return;
    e.preventDefault();
    e.stopPropagation();
    movedRef.current = false;
    dragRef.current = {
      id: block.id,
      mode,
      originY: e.clientY,
      original: rangeOf(block),
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ds-border bg-ds-card">
      <div className="flex items-center justify-between border-b border-ds-border px-4 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Day calendar</p>
        <p className="text-xs text-ds-muted">Drag planned work · locked items stay put · Open is + Add capacity</p>
      </div>
      <div className="relative overflow-x-auto">
        <div className="relative min-w-[28rem]" style={{ height }}>
          <div className="absolute inset-y-0 left-0 w-16 border-r border-ds-border bg-ds-bg">
            {ticks(viewStart, viewEnd, 30).map((t) => (
              <div
                key={t}
                className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-ds-muted"
                style={{ top: (t - viewStart) * PX_PER_MINUTE }}
              >
                {clockFromMinutes(t)}
              </div>
            ))}
          </div>
          <div className="absolute inset-y-0 left-16 right-0">
            {ticks(viewStart, viewEnd, SNAP_MINUTES).map((t) => (
              <div
                key={t}
                className={`absolute inset-x-0 border-t ${
                  t % 60 === workA % 60 ? "border-ds-border" : "border-ds-border/50"
                }`}
                style={{ top: (t - viewStart) * PX_PER_MINUTE }}
              />
            ))}
            {nowMin != null && nowMin >= viewStart && nowMin <= viewEnd ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                style={{ top: (nowMin - viewStart) * PX_PER_MINUTE }}
              >
                <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
              </div>
            ) : null}

            {gaps.map((gap) => {
              const top = (gap.start - viewStart) * PX_PER_MINUTE;
              const h = (gap.end - gap.start) * PX_PER_MINUTE;
              return (
                <button
                  key={`${gap.start}-${gap.end}`}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    setAddDraft({
                      start: gap.start,
                      end: Math.min(gap.end, gap.start + 60),
                      title: "",
                      categoryId: categories[0]?.id || "",
                    })
                  }
                  className="absolute inset-x-3 z-0 flex items-center justify-center rounded-lg border border-dashed border-ds-border/80 text-xs text-ds-muted hover:border-ds-primary hover:bg-ds-secondary/40 hover:text-ds-foreground"
                  style={{ top, height: Math.max(h, 18) }}
                >
                  + Add block
                  <span className="ml-1 hidden sm:inline">· Open capacity</span>
                </button>
              );
            })}

            {local.filter((block) => !isCapacityBlock(block)).map((block) => {
              const range = rangeOf(block);
              const top = (range.start - viewStart) * PX_PER_MINUTE;
              const h = Math.max((range.end - range.start) * PX_PER_MINUTE, 18);
              const color = block.category_color || (block.block_type === "meeting" ? "#64748b" : "#94a3b8");
              const text = contrastText(color);
              const selected = selectedId === block.id;
              const immovable = isImmovableBlock(block);
              return (
                <div
                  key={block.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (movedRef.current) {
                      movedRef.current = false;
                      return;
                    }
                    setSelectedId(block.id);
                  }}
                  onPointerDown={(e) => startDrag(e, block, "move")}
                  className={`absolute inset-x-3 z-10 overflow-hidden rounded-lg border shadow-sm ${
                    selected ? "ring-2 ring-ds-primary" : ""
                  } ${nowId === block.id ? "ring-2 ring-white/70" : ""}`}
                  style={{
                    top,
                    height: h,
                    background: color,
                    color: text,
                    borderColor: color,
                    cursor: disabled || immovable ? "default" : "grab",
                  }}
                >
                  {immovable ? null : (
                    <>
                      <button
                        type="button"
                        aria-label="Resize start"
                        className="absolute inset-x-0 top-0 z-10 h-2 cursor-ns-resize"
                        onPointerDown={(e) => startDrag(e, block, "resize-start")}
                      />
                      <button
                        type="button"
                        aria-label="Resize end"
                        className="absolute inset-x-0 bottom-0 z-10 h-2 cursor-ns-resize"
                        onPointerDown={(e) => startDrag(e, block, "resize-end")}
                      />
                    </>
                  )}
                  <div className="pointer-events-none px-2 py-1">
                    <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">
                      {hhmm(block.start_time)}–{hhmm(block.end_time)}
                      {nowId === block.id ? " · now" : nextId === block.id ? " · next" : ""}
                      {immovable ? " · locked" : ""}
                    </p>
                    <p className="truncate text-sm font-semibold leading-tight">{block.title}</p>
                    <p className="truncate text-[11px] opacity-80">{block.category_name ?? block.block_type}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedId ? (
        <BlockEditor
          block={local.find((row) => row.id === selectedId) ?? null}
          categories={categories}
          disabled={disabled}
          onClose={() => setSelectedId(null)}
          onPatch={onPatch}
          onDelete={async (id) => {
            await onDelete(id);
            setSelectedId(null);
          }}
        />
      ) : null}

      {addDraft ? (
        <div className="border-t border-ds-border bg-ds-bg px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">
            New block · {clockFromMinutes(addDraft.start)}–{clockFromMinutes(addDraft.end)}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input
              className="rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm"
              placeholder="Title"
              value={addDraft.title}
              onChange={(e) => setAddDraft({ ...addDraft, title: e.target.value })}
            />
            <select
              className="rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm"
              value={addDraft.categoryId}
              onChange={(e) => setAddDraft({ ...addDraft, categoryId: e.target.value })}
            >
              <option value="">No category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg border border-ds-border px-3 py-2 text-sm"
                onClick={() => setAddDraft(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-ds-primary px-3 py-2 text-sm font-medium text-white"
                disabled={disabled}
                onClick={async () => {
                  await onAdd(
                    clockFromMinutes(addDraft.start),
                    clockFromMinutes(addDraft.end),
                    addDraft.title.trim() || "Open",
                    addDraft.categoryId || null,
                  );
                  setAddDraft(null);
                }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BlockEditor({
  block,
  categories,
  disabled,
  onClose,
  onPatch,
  onDelete,
}: {
  block: PlannerBlock | null;
  categories: PlannerCategory[];
  disabled?: boolean;
  onClose: () => void;
  onPatch: (id: string, body: { title?: string; category_id?: string | null }) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(block?.title ?? "");
  const [categoryId, setCategoryId] = useState(block?.category_id ?? "");

  useEffect(() => {
    setTitle(block?.title ?? "");
    setCategoryId(block?.category_id ?? "");
  }, [block?.id, block?.title, block?.category_id]);

  if (!block) return null;

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-ds-border bg-ds-bg px-4 py-3">
      <label className="min-w-[12rem] flex-1">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-ds-muted">Title</span>
        <input
          className="w-full rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm"
          value={title}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() && title.trim() !== block.title) void onPatch(block.id, { title: title.trim() });
          }}
        />
      </label>
      <label className="w-56">
        <span className="mb-1 block text-[11px] uppercase tracking-wide text-ds-muted">Category color</span>
        <select
          className="w-full rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm"
          value={categoryId}
          disabled={disabled}
          onChange={(e) => {
            const value = e.target.value;
            setCategoryId(value);
            void onPatch(block.id, { category_id: value || null });
          }}
        >
          <option value="">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="rounded-lg border border-red-300 px-3 py-2 text-sm text-red-800"
        disabled={disabled}
        onClick={() => void onDelete(block.id)}
      >
        Delete
      </button>
      <button type="button" className="rounded-lg border border-ds-border px-3 py-2 text-sm" onClick={onClose}>
        Done
      </button>
    </div>
  );
}
