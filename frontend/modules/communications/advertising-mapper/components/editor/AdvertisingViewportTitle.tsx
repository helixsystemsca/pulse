"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  onRename: (name: string) => void;
  /** `breadcrumb` — inline in header; `overlay` — floating on canvas. */
  variant?: "breadcrumb" | "overlay";
  className?: string;
};

/** Viewport name with inline edit. */
export function AdvertisingViewportTitle({ name, onRename, variant = "breadcrumb", className }: Props) {
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

  const isBreadcrumb = variant === "breadcrumb";

  return (
    <div
      className={cn(
        "pointer-events-auto flex max-w-[min(100%,20rem)] items-center gap-1.5",
        !isBreadcrumb && "rounded-xl border border-slate-200/80 bg-white/90 px-4 py-2 shadow-sm backdrop-blur-sm",
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
          className={cn(
            "min-w-[6rem] flex-1 border-0 bg-transparent p-0 font-semibold text-slate-900 outline-none ring-0",
            isBreadcrumb ? "text-sm" : "text-center text-2xl",
          )}
          maxLength={48}
        />
      ) : (
        <span
          className={cn(
            "truncate font-semibold text-slate-900",
            isBreadcrumb ? "text-sm" : "text-center text-2xl",
          )}
        >
          {name}
        </span>
      )}
      <button
        type="button"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-sky-700",
          isBreadcrumb ? "h-6 w-6" : "h-8 w-8",
        )}
        aria-label={editing ? "Save viewport name" : "Edit viewport name"}
        title={editing ? "Save" : "Edit name"}
        onClick={() => {
          if (editing) commit();
          else setEditing(true);
        }}
      >
        <Pencil className={isBreadcrumb ? "h-3 w-3" : "h-4 w-4"} aria-hidden />
      </button>
    </div>
  );
}
