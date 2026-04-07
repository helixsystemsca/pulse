"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { bpTransition } from "@/lib/motion-presets";
import { BlueprintSymbolTile } from "./BlueprintSymbolTile";
import {
  BLUEPRINT_SYMBOL_RECENT_KEY,
  SYMBOL_CATEGORIES,
  SYMBOL_LIBRARY,
  type SymbolLibraryId,
} from "./blueprint-symbols-shared";

const MAX_RECENT = 6;

function readRecent(): SymbolLibraryId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(BLUEPRINT_SYMBOL_RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const allowed = new Set<string>(SYMBOL_LIBRARY);
    const out: SymbolLibraryId[] = [];
    for (const x of parsed) {
      const id = String(x);
      if (allowed.has(id)) out.push(id as SymbolLibraryId);
    }
    return out.slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeRecent(ids: SymbolLibraryId[]) {
  try {
    window.localStorage.setItem(BLUEPRINT_SYMBOL_RECENT_KEY, JSON.stringify(ids.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}

export function BlueprintSymbolPanel({
  open,
  onClose,
  activeSymbolId,
  onSelectSymbol,
  disabled,
  variant = "dock",
}: {
  open: boolean;
  onClose: () => void;
  activeSymbolId: SymbolLibraryId;
  onSelectSymbol: (id: SymbolLibraryId) => void;
  disabled?: boolean;
  /** `floating`: popover over canvas; `dock`: legacy side column (unused in current layout). */
  variant?: "dock" | "floating";
}) {
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SYMBOL_CATEGORIES.map((c) => [c.id, true])),
  );
  const [recent, setRecent] = useState<SymbolLibraryId[]>([]);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  const pushRecent = useCallback((id: SymbolLibraryId) => {
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT);
      writeRecent(next);
      return next;
    });
  }, []);

  const q = query.trim().toLowerCase();

  const filteredRecent = useMemo(() => {
    if (!q) return recent;
    return recent.filter((id) => id.toLowerCase().includes(q));
  }, [recent, q]);

  const filteredCategories = useMemo(() => {
    return SYMBOL_CATEGORIES.map((cat) => {
      const symbols = cat.symbols.filter((id) => {
        if (!q) return true;
        return id.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q);
      });
      return { ...cat, symbols };
    }).filter((c) => c.symbols.length > 0);
  }, [q]);

  const pick = (id: SymbolLibraryId) => {
    if (disabled) return;
    pushRecent(id);
    onSelectSymbol(id);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          key="symbol-panel"
          className={`bp-symbol-panel${variant === "floating" ? " bp-symbol-panel--floating" : ""}${
            disabled ? " bp-symbol-panel--disabled" : ""
          }`}
          aria-label="Symbol library"
          initial={{ opacity: 0, y: variant === "floating" ? 12 : 0, x: variant === "floating" ? 0 : 20 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: variant === "floating" ? 10 : 0, x: variant === "floating" ? 0 : 16 }}
          transition={{ type: "spring", stiffness: 420, damping: 36 }}
        >
          <div className="bp-symbol-panel__head">
            <span className="bp-symbol-panel__title">Symbols</span>
            <button type="button" className="bp-symbol-panel__close" onClick={onClose} aria-label="Close symbol panel">
              <X size={18} strokeWidth={1.75} aria-hidden />
            </button>
          </div>
          <div className="bp-symbol-panel__search">
            <Search className="bp-symbol-panel__search-icon" size={16} strokeWidth={1.75} aria-hidden />
            <input
              type="search"
              className="bp-symbol-panel__search-input"
              placeholder="Search symbols…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search symbols"
            />
          </div>
          <div className="bp-symbol-panel__scroll bp-scrollable">
            {filteredRecent.length > 0 ? (
              <section className="bp-symbol-section">
                <h4 className="bp-symbol-section__label">Recently used</h4>
                <div className="bp-symbol-grid">
                  {filteredRecent.map((id) => (
                    <BlueprintSymbolTile
                      key={`r-${id}`}
                      symbolId={id}
                      label={id}
                      isActive={activeSymbolId === id}
                      onPick={pick}
                    />
                  ))}
                </div>
              </section>
            ) : null}
            {filteredCategories.map((cat) => {
              const expanded = openCats[cat.id] ?? true;
              return (
                <section key={cat.id} className="bp-symbol-category">
                  <button
                    type="button"
                    className="bp-symbol-category__head"
                    onClick={() => setOpenCats((m) => ({ ...m, [cat.id]: !expanded }))}
                    aria-expanded={expanded}
                  >
                    <ChevronDown
                      className={`bp-symbol-category__chev${expanded ? "" : " is-collapsed"}`}
                      size={18}
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <span>{cat.label}</span>
                  </button>
                  <AnimatePresence initial={false}>
                    {expanded ? (
                      <motion.div
                        key="b"
                        className="bp-symbol-category__body"
                        style={{ overflow: "hidden" }}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={bpTransition.fast}
                      >
                        <div className="bp-symbol-grid">
                          {cat.symbols.map((id) => (
                            <BlueprintSymbolTile
                              key={id}
                              symbolId={id}
                              label={id}
                              isActive={activeSymbolId === id}
                              onPick={pick}
                            />
                          ))}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </section>
              );
            })}
            {filteredCategories.length === 0 && filteredRecent.length === 0 ? (
              <p className="bp-symbol-panel__empty">No symbols match your search.</p>
            ) : null}
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
