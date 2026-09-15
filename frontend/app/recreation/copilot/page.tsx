"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { askCopilot, askCopilotQuery, listCopilotPrompts, type OpsCopilotAnswer, type OpsCopilotPrompt } from "@/lib/recreation/copilotService";
import { parseClientApiError } from "@/lib/parse-client-api-error";

export default function OpsCopilotPage() {
  const [prompts, setPrompts] = useState<OpsCopilotPrompt[]>([]);
  const [answer, setAnswer] = useState<OpsCopilotAnswer | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  const onAskQuery = useCallback(async () => {
    const q = query.trim();
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
  }, [query]);

  const chips = useMemo(() => prompts, [prompts]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ops Copilot"
        description="Ask or pick a starter question. Answers cite Pulse records and Codes & Guidance cards — not an LLM and not a legal determination."
        icon={MessageSquare}
      />
      <PageBody>
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {loading ? <p className="text-sm text-ds-muted">Loading prompts…</p> : null}

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void onAskQuery();
          }}
        >
          <input
            type="search"
            className="min-w-0 flex-1 rounded-lg border border-ds-border bg-ds-bg px-3 py-2.5 text-base sm:text-sm"
            placeholder="Ask: chief engineer responsibilities, interior health pool code, building code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Ask or search"
          />
          <button
            type="submit"
            disabled={asking || !query.trim()}
            className="rounded-lg bg-ds-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Ask
          </button>
        </form>
        <p className="text-xs text-ds-muted">
          Regulatory questions open{" "}
          <Link href="/recreation/regulations" className="text-ds-primary hover:underline">
            Codes & Guidance
          </Link>
          . Internal SOPs stay labelled as internal.
        </p>

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
          <p className="mt-6 text-sm text-ds-muted">Ask a question or choose a starter. Results stay in-app and update as you fill in records.</p>
        )}
      </PageBody>
    </div>
  );
}
