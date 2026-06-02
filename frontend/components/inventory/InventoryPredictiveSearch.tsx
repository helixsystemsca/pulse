"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { searchInventoryProducts, type InventoryScanProduct } from "@/lib/inventory-scanner/inventoryScannerService";
import { inventoryScannerHref } from "@/lib/inventory-scanner/scanner-kiosk";
import { pulseAppHref } from "@/lib/pulse-app";

type Props = {
  onOpenItem: (itemId: string) => void;
  canTransact?: boolean;
  className?: string;
};

export function InventoryPredictiveSearch({ onOpenItem, canTransact = false, className }: Props) {
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [suggestions, setSuggestions] = useState<InventoryScanProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value.trim()), 220);
    return () => window.clearTimeout(t);
  }, [value]);

  useEffect(() => {
    if (!debounced) {
      setSuggestions([]);
      return;
    }
    let cancel = false;
    setBusy(true);
    void searchInventoryProducts(debounced, 8)
      .then((rows) => {
        if (!cancel) setSuggestions(rows);
      })
      .catch(() => {
        if (!cancel) setSuggestions([]);
      })
      .finally(() => {
        if (!cancel) setBusy(false);
      });
    return () => {
      cancel = true;
    };
  }, [debounced]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = useCallback(
    (row: InventoryScanProduct) => {
      setValue("");
      setDebounced("");
      setSuggestions([]);
      setOpen(false);
      onOpenItem(row.id);
    },
    [onOpenItem],
  );

  const submit = useCallback(() => {
    const q = value.trim();
    if (!q) return;
    if (suggestions.length === 1) {
      pick(suggestions[0]);
      return;
    }
    if (suggestions.length > 0) {
      const exact = suggestions.find((r) => r.sku.toLowerCase() === q.toLowerCase());
      if (exact) {
        pick(exact);
        return;
      }
      setOpen(true);
    }
  }, [pick, suggestions, value]);

  const showList = open && value.trim().length > 0 && (suggestions.length > 0 || busy);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <label htmlFor={inputId} className="sr-only">
        Search inventory
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-pulse-muted"
          aria-hidden
        />
        <input
          id={inputId}
          type="search"
          value={value}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Search by name or SKU — open an item, issue, or receive stock"
          className={cn(
            "w-full rounded-xl border border-slate-200/90 bg-white py-3.5 pl-12 pr-4 text-base text-pulse-navy shadow-sm",
            "placeholder:text-slate-400 focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-2 focus:ring-[#2B4C7E]/20",
            "dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100 dark:placeholder:text-gray-500",
          )}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
      </div>

      {showList ? (
        <ul
          className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200/90 bg-white py-1 shadow-lg dark:border-ds-border dark:bg-ds-primary"
          role="listbox"
        >
          {busy && suggestions.length === 0 ? (
            <li className="px-4 py-3 text-sm text-pulse-muted">Searching…</li>
          ) : null}
          {suggestions.map((row) => (
            <li key={row.id} className="border-b border-slate-100 last:border-0 dark:border-ds-border/60">
              <button
                type="button"
                role="option"
                className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-ds-interactive-hover"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(row)}
              >
                <span className="font-semibold text-pulse-navy dark:text-gray-100">{row.name}</span>
                <span className="text-sm text-pulse-muted">
                  {row.sku} · {row.quantity} {row.unit} on hand
                  {row.location_name ? ` · ${row.location_name}` : ""}
                </span>
              </button>
              {canTransact ? (
                <div className="flex gap-2 px-4 pb-2">
                  <Link
                    href={pulseAppHref(inventoryScannerHref({ mode: "issue" }))}
                    className="text-xs font-semibold text-[#2B4C7E] hover:underline dark:text-ds-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Issue
                  </Link>
                  <Link
                    href={pulseAppHref(inventoryScannerHref({ mode: "receive" }))}
                    className="text-xs font-semibold text-[#2B4C7E] hover:underline dark:text-ds-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Receive
                  </Link>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
