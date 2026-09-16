"use client";

import { Suspense, useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { askCopilot, askCopilotQuery, listCopilotPrompts, type OpsCopilotAnswer, type OpsCopilotPrompt } from "@/lib/recreation/copilotService";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { resolveAuthorizedNavItems } from "@/lib/navigation/build-navigation-tree";
import { matchCopilotPromptId, routeOpsAsk } from "@/lib/search/ops-ask-router";
import { opsAskShortcutLabel } from "@/lib/search/ops-ask-hotkey";

function OpsCopilotInner() {
  const search = useSearchParams();
  const promptParam = search.get("prompt");
  const { session } = usePulseAuth();
  const [prompts, setPrompts] = useState<OpsCopilotPrompt[]>([]);
  const [answer, setAnswer] = useState<OpsCopilotAnswer | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState("Ctrl+K");

  useEffect(() => {
    setShortcut(opsAskShortcutLabel());
  }, []);

  useEffect(() => {
    void listCopilotPrompts()
      .then(setPrompts)
      .catch((e) => setError(parseClientApiError(e).message))
      .finally(() => setLoading(false));
  }, []);

  const onAsk = useCallback(async (id: string) => {
    setAsking(true);
    setError(null);
    setActiveId(id);
    try {
      setAnswer(await askCopilot(id));
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setAsking(false);
    }
  }, []);

  const onAskQuery = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    setAsking(true);
    setError(null);
    setActiveId(null);
    try {
      setAnswer(await askCopilotQuery(q));
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setAsking(false);
    }
  }, []);

  useEffect(() => {
    if (!promptParam || loading) return;
    void onAsk(promptParam);
  }, [promptParam, loading, onAsk]);

  const navHints = useMemo(
    () => resolveAuthorizedNavItems(session).map((i) => ({ label: i.label, href: i.href })),
    [session],
  );
  const dest = useMemo(
    () => (typed.trim() ? routeOpsAsk(typed, session, navHints) : null),
    [typed, session, navHints],
  );

  const chips = useMemo(() => prompts, [prompts]);

  function submitTyped(e: FormEvent) {
    e.preventDefault();
    const id = matchCopilotPromptId(typed) ?? dest?.copilotPromptId;
    if (id) {
      void onAsk(id);
      return;
    }
    if (typed.trim()) void onAskQuery(typed);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ops Copilot"
        description="Ask or pick a starter. Answers cite Pulse records and Codes & Guidance cards — not an LLM and not a legal determination. Press Search / Ask in the header (or the keyboard shortcut) from any page to find where to go."
        icon={MessageSquare}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {loading ? <p className="text-sm text-ds-muted">Loading prompts…</p> : null}

        <form onSubmit={submitTyped} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="ops-copilot-ask">
            Ask in plain language
          </label>
          <input
            id="ops-copilot-ask"
            type="search"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={`Ask: chief engineer, refrigeration operator, ammonia plant, or press ${shortcut} anywhere`}
            className="min-w-0 flex-1 rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm text-ds-foreground"
            aria-label="Ask or search"
          />
          <button
            type="submit"
            disabled={asking || !typed.trim()}
            className="rounded-lg bg-ds-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Ask
          </button>
        </form>
        <p className="mb-4 text-xs text-ds-muted">
          Regulatory questions open{" "}
          <Link href="/recreation/regulations" className="text-ds-primary hover:underline">
            Codes & Guidance
          </Link>
          . Internal SOPs stay labelled as internal.
        </p>

        {dest?.matched ? (
          <div className="mb-4 rounded-xl border border-ds-border bg-ds-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Where to go</p>
            <ul className="mt-2 space-y-1 text-sm">
              {dest.results.map((r) => (
                <li key={r.id}>
                  <Link href={r.href} className="font-medium text-[#2B4C7E] hover:underline">
                    {r.title}
                  </Link>
                  <span className="text-ds-muted"> — {r.why}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {chips.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={asking}
              onClick={() => void onAsk(p.id)}
              className={`rounded-full border px-3 py-1.5 text-left text-sm ${
                activeId === p.id
                  ? "border-ds-primary bg-ds-primary text-white"
                  : "border-ds-border bg-ds-card text-ds-foreground hover:border-ds-primary/40"
              }`}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>

        {asking ? <p className="mt-4 text-sm text-ds-muted">Looking up current records…</p> : null}

        {answer ? (
          <article className="mt-6 space-y-4 rounded-xl border border-ds-border bg-ds-card p-4">
            <h2 className="text-base font-semibold text-ds-foreground">{answer.label}</h2>
            <p className="whitespace-pre-wrap text-sm text-ds-foreground">{answer.answer}</p>
            {answer.citations.length ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Cited records</h3>
                <ul className="mt-2 space-y-1 text-sm">
                  {answer.citations.map((c, i) => (
                    <li key={`${c.href}-${i}`}>
                      <Link href={c.href} className="font-medium text-[#2B4C7E] hover:underline">
                        {c.title}
                      </Link>
                      <span className="text-ds-muted">
                        {" "}
                        · {c.kind}
                        {c.detail ? ` · ${c.detail}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="text-xs text-amber-800">{answer.disclaimer}</p>
          </article>
        ) : (
          <p className="mt-6 text-sm text-ds-muted">
            Ask a question or choose a starter. Navigation help is also in the header Ask / Search control. Results stay
            in-app and update as you fill in records.
          </p>
        )}
      </PageBody>
    </div>
  );
}

export default function OpsCopilotPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-ds-muted">Loading Ops Copilot…</p>
        </div>
      }
    >
      <OpsCopilotInner />
    </Suspense>
  );
}
