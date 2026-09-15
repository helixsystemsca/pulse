"use client";

/**
 * Global Ask / Search palette — Cmd/Ctrl+K.
 * Catalog + fuzzy nav first; Ops Copilot citations are an optional enhancer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Sparkles, X } from "lucide-react";
import { APP_MODAL_PORTAL_Z_BASE } from "@/components/ui/app-modal-layer";
import { cn } from "@/lib/cn";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { pulseApp } from "@/lib/pulse-app";
import { resolveAuthorizedNavItems } from "@/lib/navigation/build-navigation-tree";
import { canAccessClassicNavHref } from "@/lib/rbac/session-access";
import { askCopilot, type OpsCopilotCitation } from "@/lib/recreation/copilotService";
import { OPS_ASK_EXAMPLE_QUERIES } from "@/lib/search/ops-destination-catalog";
import { routeOpsAsk, type OpsAskResult } from "@/lib/search/ops-ask-router";
import { opsAskShortcutLabel } from "@/lib/search/ops-ask-hotkey";

type Props = {
  open: boolean;
  onClose: () => void;
};

type ListRow =
  | { kind: "result"; result: OpsAskResult }
  | { kind: "fallback"; result: OpsAskResult }
  | { kind: "citation"; citation: OpsCopilotCitation; index: number };

export function OpsAskPalette({ open, onClose }: Props) {
  const router = useRouter();
  const { session } = usePulseAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [shortcut, setShortcut] = useState("Ctrl+K");
  const [citations, setCitations] = useState<OpsCopilotCitation[]>([]);
  const [copilotLoading, setCopilotLoading] = useState(false);

  const navHints = useMemo(
    () => resolveAuthorizedNavItems(session).map((i) => ({ label: i.label, href: i.href })),
    [session],
  );

  const answer = useMemo(() => routeOpsAsk(query, session, navHints), [query, session, navHints]);

  const rows: ListRow[] = useMemo(() => {
    if (!query.trim()) return [];
    if (answer.matched) {
      const list: ListRow[] = answer.results.map((result) => ({ kind: "result", result }));
      citations.forEach((citation, index) => list.push({ kind: "citation", citation, index }));
      return list;
    }
    return answer.fallbacks.map((result) => ({ kind: "fallback", result }));
  }, [answer.fallbacks, answer.matched, answer.results, citations, query]);

  useEffect(() => {
    setShortcut(opsAskShortcutLabel());
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setCitations([]);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, citations.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const promptId = answer.copilotPromptId;
    if (!promptId || !query.trim() || !canAccessClassicNavHref(session, "/recreation/copilot")) {
      setCitations([]);
      setCopilotLoading(false);
      return;
    }
    let cancelled = false;
    setCopilotLoading(true);
    void askCopilot(promptId)
      .then((res) => {
        if (!cancelled) setCitations(res.citations.slice(0, 5));
      })
      .catch(() => {
        if (!cancelled) setCitations([]);
      })
      .finally(() => {
        if (!cancelled) setCopilotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, answer.copilotPromptId, query, session]);

  const go = useCallback(
    (href: string) => {
      onClose();
      router.push(pulseApp.to(href));
    },
    [onClose, router],
  );

  const activate = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row) return;
      if (row.kind === "citation") go(row.citation.href);
      else go(row.result.href);
    },
    [go, rows],
  );

  if (!open) return null;

  return (
    <div
      className={cn(APP_MODAL_PORTAL_Z_BASE, "fixed inset-0 flex items-start justify-center px-3 pt-[12vh] sm:px-4")}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ops-ask-title"
    >
      <button type="button" className="absolute inset-0 bg-black/45 backdrop-blur-[1px]" aria-label="Close search" onClick={onClose} />
      <div className="relative flex max-h-[min(34rem,78vh)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-ds-border bg-ds-elevated shadow-[var(--ds-shadow-diffuse)]">
        <div className="flex items-center gap-2 border-b border-ds-border px-3 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-ds-muted" strokeWidth={2} aria-hidden />
          <input
            ref={inputRef}
            id="ops-ask-input"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, Math.max(0, rows.length - 1)));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (rows.length) activate(active);
              }
            }}
            placeholder="Ask where to go, or search modules…"
            className="min-w-0 flex-1 bg-transparent text-sm text-ds-foreground placeholder:text-ds-muted focus:outline-none"
            aria-labelledby="ops-ask-title"
            aria-controls="ops-ask-results"
          />
          <h2 id="ops-ask-title" className="sr-only">
            Search or ask
          </h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-ds-muted hover:bg-ds-secondary hover:text-ds-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div id="ops-ask-results" className="min-h-0 flex-1 overflow-y-auto px-2 py-2" role="listbox">
          {!query.trim() ? (
            <div className="space-y-3 px-2 py-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Try asking</p>
              <ul className="space-y-1">
                {OPS_ASK_EXAMPLE_QUERIES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-ds-foreground hover:bg-ds-secondary"
                      onClick={() => setQuery(example)}
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Browse</p>
              <ul className="space-y-1">
                {answer.fallbacks.map((item, i) => (
                  <ResultButton
                    key={item.id}
                    title={item.title}
                    why={item.why}
                    active={active === i}
                    onHover={() => setActive(i)}
                    onClick={() => go(item.href)}
                  />
                ))}
              </ul>
            </div>
          ) : answer.matched ? (
            <div className="space-y-1">
              {answer.results.map((item, i) => (
                <ResultButton
                  key={item.id}
                  title={item.title}
                  why={item.why}
                  howTo={item.howTo}
                  copilot={item.source === "copilot"}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => go(item.href)}
                />
              ))}
              {copilotLoading ? (
                <p className="px-2 py-1.5 text-xs text-ds-muted">Looking up matching records…</p>
              ) : null}
              {citations.length ? (
                <div className="mt-2 border-t border-ds-border pt-2">
                  <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">
                    From current records
                  </p>
                  {citations.map((c, i) => {
                    const index = answer.results.length + i;
                    return (
                      <ResultButton
                        key={`${c.href}-${i}`}
                        title={c.title}
                        why={`${c.kind}${c.detail ? ` · ${c.detail}` : ""}`}
                        active={active === index}
                        onHover={() => setActive(index)}
                        onClick={() => go(c.href)}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-2 px-1 py-1">
              <p className="px-2 text-sm text-ds-foreground">{answer.summary}</p>
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Browse</p>
              {answer.fallbacks.map((item, i) => (
                <ResultButton
                  key={item.id}
                  title={item.title}
                  why={item.why}
                  active={active === i}
                  onHover={() => setActive(i)}
                  onClick={() => go(item.href)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-ds-border px-3 py-2 text-[11px] text-ds-muted">
          <span>Enter to open · Esc to close</span>
          <span>{shortcut}</span>
        </div>
      </div>
    </div>
  );
}

function ResultButton({
  title,
  why,
  howTo,
  copilot,
  active,
  onHover,
  onClick,
}: {
  title: string;
  why: string;
  howTo?: string;
  copilot?: boolean;
  active: boolean;
  onHover: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={cn(
        "flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left",
        active ? "bg-ds-secondary" : "hover:bg-ds-secondary/70",
      )}
      onMouseEnter={onHover}
      onClick={onClick}
    >
      {copilot ? (
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ds-muted" strokeWidth={2} aria-hidden />
      ) : (
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-ds-muted" strokeWidth={2} aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ds-foreground">{title}</span>
        <span className="mt-0.5 block text-xs text-ds-muted">{why}</span>
        {howTo && active ? <span className="mt-1 block text-xs text-ds-foreground/90">{howTo}</span> : null}
      </span>
    </button>
  );
}
