"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fetchInventoryList, type InventoryRow } from "@/lib/inventoryService";
const FIELD =
  "mt-1.5 w-full rounded-[10px] border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-1 focus:ring-[#2B4C7E]/25";

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  companyId: string | null;
  excludeItemId?: string | null;
  minChars?: number;
};

export function InventoryRegisterLookupHints({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  companyId,
  excludeItemId,
  minChars = 2,
}: Props) {
  const inputId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [matches, setMatches] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (!companyId || q.length < minChars) {
      setMatches([]);
      return;
    }
    let cancel = false;
    const t = window.setTimeout(() => {
      setLoading(true);
      void fetchInventoryList({ companyId, q, limit: 8, offset: 0 })
        .then((res) => {
          if (cancel) return;
          const items = res.items.filter((r) => r.id !== excludeItemId);
          setMatches(items);
        })
        .catch(() => {
          if (!cancel) setMatches([]);
        })
        .finally(() => {
          if (!cancel) setLoading(false);
        });
    }, 200);
    return () => {
      cancel = true;
      window.clearTimeout(t);
    };
  }, [companyId, excludeItemId, minChars, value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const showList = open && value.trim().length >= minChars && (loading || matches.length > 0);

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-pulse-muted" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className={FIELD}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {showList ? (
        <ul
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-[10px] border border-slate-200/90 bg-white py-1 shadow-lg dark:border-ds-border dark:bg-ds-elevated"
          role="listbox"
        >
          {loading ? (
            <li className="px-3 py-2 text-xs text-pulse-muted">Searching…</li>
          ) : (
            matches.map((row) => (
              <li key={row.id} role="option">
                <div className="px-3 py-2">
                  <p className="text-sm font-semibold text-pulse-navy dark:text-gray-100">{row.name}</p>
                  <p className="text-xs text-pulse-muted">
                    {row.sku}
                    {row.category ? ` · ${row.category}` : ""}
                    {row.quantity != null ? ` · ${row.quantity} ${row.unit}` : ""}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    Already in inventory
                  </p>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {open && value.trim().length >= minChars && !loading && matches.length === 0 ? (
        <p className="mt-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">No matching items — name looks new.</p>
      ) : null}
    </div>
  );
}
