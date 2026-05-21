"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type AssetTargetOption = {
  kind: "asset" | "equipment";
  id: string;
  label: string;
  hint?: string;
};

type WorkRequestAssetTargetFieldProps = {
  assets: ReadonlyArray<{ id: string; name: string; tag_id?: string | null }>;
  equipment: ReadonlyArray<{ id: string; name: string }>;
  toolId: string;
  equipmentId: string;
  onSelect: (next: { tool_id: string; equipment_id: string }) => void;
  labelClassName?: string;
  fieldClassName?: string;
};

const MIN_QUERY = 3;

export function WorkRequestAssetTargetField({
  assets,
  equipment,
  toolId,
  equipmentId,
  onSelect,
  labelClassName,
  fieldClassName,
}: WorkRequestAssetTargetFieldProps) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    if (toolId) {
      const a = assets.find((x) => x.id === toolId);
      if (a) return a.tag_id ? `${a.name} (${a.tag_id})` : a.name;
    }
    if (equipmentId) {
      return equipment.find((x) => x.id === equipmentId)?.name ?? "";
    }
    return "";
  }, [assets, equipment, toolId, equipmentId]);

  useEffect(() => {
    if (!toolId && !equipmentId) return;
    setQuery(selectedLabel);
  }, [toolId, equipmentId, selectedLabel]);

  const options = useMemo((): AssetTargetOption[] => {
    const q = query.trim().toLowerCase();
    if (q.length < MIN_QUERY) return [];
    const out: AssetTargetOption[] = [];
    for (const a of assets) {
      const hay = `${a.name} ${a.tag_id ?? ""}`.toLowerCase();
      if (hay.includes(q)) {
        out.push({
          kind: "asset",
          id: a.id,
          label: a.name,
          hint: a.tag_id ? `Asset · ${a.tag_id}` : "Asset",
        });
      }
    }
    for (const eq of equipment) {
      if (eq.name.toLowerCase().includes(q)) {
        out.push({
          kind: "equipment",
          id: eq.id,
          label: eq.name,
          hint: "Equipment",
        });
      }
    }
    return out.slice(0, 12);
  }, [query, assets, equipment]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(opt: AssetTargetOption) {
    if (opt.kind === "asset") {
      onSelect({ tool_id: opt.id, equipment_id: "" });
    } else {
      onSelect({ tool_id: "", equipment_id: opt.id });
    }
    setQuery(opt.hint ? `${opt.label} · ${opt.hint.split(" · ").pop()}` : opt.label);
    setOpen(false);
  }

  function clear() {
    onSelect({ tool_id: "", equipment_id: "" });
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className={labelClassName} htmlFor={listId}>
        Asset or equipment
      </label>
      <div className="relative mt-1.5">
        <input
          id={listId}
          className={cn(fieldClassName, "mt-0", (toolId || equipmentId) && query ? "pr-14" : "")}
          value={query}
          placeholder="Type at least 3 characters to search…"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls={`${listId}-listbox`}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setOpen(true);
            if (toolId || equipmentId) onSelect({ tool_id: "", equipment_id: "" });
          }}
          onFocus={() => setOpen(true)}
        />
        {(toolId || equipmentId) && query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-pulse-muted hover:text-pulse-navy"
            onClick={clear}
          >
            Clear
          </button>
        ) : null}
      </div>
      {open && options.length > 0 ? (
        <ul
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-ds-border dark:bg-ds-elevated"
        >
          {options.map((opt) => (
            <li key={`${opt.kind}-${opt.id}`} role="option">
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col px-3 py-2 text-left hover:bg-ds-interactive-hover",
                  (opt.kind === "asset" && toolId === opt.id) ||
                    (opt.kind === "equipment" && equipmentId === opt.id)
                    ? "bg-ds-interactive-hover"
                    : "",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(opt)}
              >
                <span className="font-medium text-pulse-navy dark:text-gray-100">{opt.label}</span>
                {opt.hint ? <span className="text-xs text-pulse-muted">{opt.hint}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= MIN_QUERY && options.length === 0 ? (
        <p className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-pulse-muted shadow-lg dark:border-ds-border dark:bg-ds-elevated">
          No matching assets or equipment
        </p>
      ) : null}
    </div>
  );
}
