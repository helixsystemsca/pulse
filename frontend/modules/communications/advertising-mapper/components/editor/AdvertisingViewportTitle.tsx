"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  onRename: (name: string) => void;
  className?: string;
};

/** Centered viewport name above the arena canvas (not the page header). */
export function AdvertisingViewportTitle({ name, onRename, className }: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
    setEditing(false);
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex max-w-[min(100%,28rem)] items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {editing ? (
        <label htmlFor={inputId} className="sr-only">
          Viewport name
        </label>
      ) : null}
      {editing ? (
        <input
          ref={inputRef}
          id={inputId}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="min-w-[10rem] flex-1 border-0 bg-transparent p-0 text-center text-2xl font-semibold tracking-tight text-slate-900 outline-none ring-0"
          maxLength={48}
        />
      ) : (
        <h2 className="truncate text-center text-2xl font-semibold tracking-tight text-slate-900">{name}</h2>
      )}
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-sky-700"
        aria-label={editing ? "Save viewport name" : "Edit viewport name"}
        title={editing ? "Save" : "Edit name"}
        onClick={() => {
          if (editing) commit();
          else setEditing(true);
        }}
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
