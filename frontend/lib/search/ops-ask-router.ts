/**
 * Hybrid Ask / Search router: curated intent catalog + fuzzy match over authorized nav labels.
 * Deterministic — no external LLM. Optional Ops Copilot prompt id for record citations.
 */
import { canAccessClassicNavHref } from "@/lib/rbac/session-access";
import type { PulseAuthSession } from "@/lib/pulse-session";
import {
  OPS_ASK_BROWSE_FALLBACK_IDS,
  OPS_ASK_CATALOG,
  OPS_COPILOT_PROMPT_MATCHERS,
  type OpsAskCatalogItem,
} from "@/lib/search/ops-destination-catalog";

const STOPWORDS = new Set([
  "where",
  "do",
  "i",
  "a",
  "an",
  "the",
  "for",
  "how",
  "to",
  "of",
  "in",
  "on",
  "is",
  "are",
  "my",
  "me",
  "can",
  "you",
  "please",
  "what",
  "whats",
  "which",
  "who",
  "whom",
  "at",
  "from",
  "with",
  "and",
  "or",
  "go",
  "open",
  "find",
  "show",
  "tell",
  "get",
  "take",
  "see",
  "look",
  "need",
  "want",
  "should",
  "would",
  "could",
  "does",
  "did",
  "just",
  "some",
  "any",
  "this",
  "that",
  "there",
  "here",
]);

export type OpsAskNavHint = {
  label: string;
  href: string;
};

export type OpsAskResult = {
  id: string;
  title: string;
  href: string;
  why: string;
  howTo?: string;
  score: number;
  source: "intent" | "fuzzy" | "copilot";
  copilotPromptId?: string;
};

export type OpsAskAnswer = {
  query: string;
  matched: boolean;
  results: OpsAskResult[];
  fallbacks: OpsAskResult[];
  copilotPromptId?: string;
  summary?: string;
};

export function normalizeAskQuery(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function askQueryTokens(raw: string): string[] {
  return normalizeAskQuery(raw)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function phraseScore(normalizedQuery: string, queryTokens: readonly string[], phrases: readonly string[]): number {
  let best = 0;
  const qTok = new Set(queryTokens);
  for (const phrase of phrases) {
    const np = normalizeAskQuery(phrase);
    if (!np) continue;
    if (normalizedQuery === np) {
      best = Math.max(best, 120);
      continue;
    }
    if (normalizedQuery.includes(np)) {
      best = Math.max(best, 105);
      continue;
    }
    if (np.includes(normalizedQuery) && normalizedQuery.length >= 10) {
      best = Math.max(best, 72);
      continue;
    }
    const pToks = askQueryTokens(phrase);
    if (pToks.length && pToks.every((t) => qTok.has(t))) {
      best = Math.max(best, 20 + pToks.length * 18);
    }
  }
  return best;
}

function keywordScore(queryTokens: readonly string[], keywords: readonly string[]): number {
  if (!queryTokens.length) return 0;
  const q = new Set(queryTokens);
  let hits = 0;
  for (const kw of keywords) {
    const parts = askQueryTokens(kw);
    if (parts.length && parts.every((p) => q.has(p))) hits += 1;
  }
  return Math.min(42, hits * 12);
}

export function fuzzyTextScore(query: string, haystack: string): number {
  const q = normalizeAskQuery(query);
  const h = normalizeAskQuery(haystack);
  if (!q || !h) return 0;
  if (h === q) return 90;
  if (h.includes(q)) return Math.min(78, 55 + q.length);
  const qTokens = askQueryTokens(query);
  if (!qTokens.length) return 0;
  const hTokens = askQueryTokens(haystack);
  const hSet = new Set(hTokens);
  let hits = 0;
  for (const t of qTokens) {
    if (hSet.has(t)) {
      hits += 1;
      continue;
    }
    const prefix = hTokens.some((ht) => (ht.startsWith(t) || t.startsWith(ht)) && Math.min(t.length, ht.length) >= 3);
    if (prefix) hits += 0.55;
  }
  return (hits / qTokens.length) * 58;
}

function isHrefAllowed(session: PulseAuthSession | null, href: string): boolean {
  return canAccessClassicNavHref(session, href);
}

function catalogHref(item: OpsAskCatalogItem, normalizedQuery: string): string {
  return item.hrefForQuery?.(normalizedQuery) ?? item.href;
}

function toResult(item: OpsAskCatalogItem, href: string, score: number, source: OpsAskResult["source"]): OpsAskResult {
  return {
    id: item.id,
    title: item.title,
    href,
    why: item.why,
    howTo: item.howTo,
    score,
    source,
    copilotPromptId: item.copilotPromptId,
  };
}

export function matchCopilotPromptId(query: string): string | undefined {
  const q = normalizeAskQuery(query);
  if (!q) return undefined;
  const qTok = askQueryTokens(query);
  let bestId: string | undefined;
  let best = 0;
  for (const p of OPS_COPILOT_PROMPT_MATCHERS) {
    const s = phraseScore(q, qTok, p.phrases);
    if (s > best) {
      best = s;
      bestId = p.id;
    }
  }
  return best >= 70 ? bestId : undefined;
}

function fallbackResults(session: PulseAuthSession | null): OpsAskResult[] {
  const out: OpsAskResult[] = [];
  for (const id of OPS_ASK_BROWSE_FALLBACK_IDS) {
    const item = OPS_ASK_CATALOG.find((c) => c.id === id);
    if (!item) continue;
    if (!isHrefAllowed(session, item.href)) continue;
    out.push(toResult(item, item.href, 1, "intent"));
  }
  return out.slice(0, 5);
}

const MATCH_THRESHOLD = 28;

/**
 * Rank destinations for a plain-language ops question.
 * Primary hits respect RBAC / enabled features. Fallbacks are the browse list when unsure.
 */
export function routeOpsAsk(
  query: string,
  session: PulseAuthSession | null,
  navItems: readonly OpsAskNavHint[] = [],
): OpsAskAnswer {
  const trimmed = query.trim();
  const normalized = normalizeAskQuery(trimmed);
  const qTokens = askQueryTokens(trimmed);
  const fallbacks = fallbackResults(session);

  if (!normalized) {
    return {
      query: trimmed,
      matched: false,
      results: [],
      fallbacks,
      summary: "Type a question — for example “Where do I add a PM for the ice plant?”",
    };
  }

  const scored: OpsAskResult[] = [];

  for (const item of OPS_ASK_CATALOG) {
    const href = catalogHref(item, normalized);
    if (!isHrefAllowed(session, href) && !isHrefAllowed(session, item.href)) continue;
    const allowedHref = isHrefAllowed(session, href) ? href : item.href;
    if (!isHrefAllowed(session, allowedHref)) continue;

    const pScore = phraseScore(normalized, qTokens, item.phrases);
    const kScore = keywordScore(qTokens, item.keywords);
    const titleScore = fuzzyTextScore(trimmed, `${item.title} ${item.why}`);
    const raw = pScore + kScore + titleScore * 0.35 + (item.weight ?? 0);
    if (raw < 8) continue;
    scored.push(toResult(item, allowedHref, raw, pScore >= 70 ? "intent" : "fuzzy"));
  }

  for (const nav of navItems) {
    if (!nav.href || !isHrefAllowed(session, nav.href)) continue;
    const score = fuzzyTextScore(trimmed, nav.label);
    if (score < 32) continue;
    scored.push({
      id: `nav:${nav.href}`,
      title: nav.label,
      href: nav.href,
      why: "Matches a module in your navigation.",
      score,
      source: "fuzzy",
    });
  }

  const copilotId = matchCopilotPromptId(trimmed);
  if (copilotId && isHrefAllowed(session, "/recreation/copilot")) {
    const spec = OPS_COPILOT_PROMPT_MATCHERS.find((p) => p.id === copilotId);
    if (spec && !scored.some((r) => r.id === `copilot:${copilotId}`)) {
      scored.push({
        id: `copilot:${copilotId}`,
        title: `Ops Copilot — ${spec.label}`,
        href: `/recreation/copilot?prompt=${encodeURIComponent(copilotId)}`,
        why: "Ask Copilot for an answer that cites current Pulse records (not an LLM).",
        score: 88,
        source: "copilot",
        copilotPromptId: copilotId,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const deduped: OpsAskResult[] = [];
  for (const row of scored) {
    const key = row.href.split("?")[0] ?? row.href;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
  }

  const results = deduped.filter((r) => r.score >= MATCH_THRESHOLD).slice(0, 6);
  const matched = results.length > 0;

  if (copilotId && results.length) {
    const top = results[0];
    if (top && !top.copilotPromptId) {
      results[0] = { ...top, copilotPromptId: copilotId };
    }
  }

  return {
    query: trimmed,
    matched,
    results: matched ? results : [],
    fallbacks,
    copilotPromptId: copilotId,
    summary: matched
      ? undefined
      : "Nothing matched that question. Try one of these high-value places, or rephrase with a module name (equipment, inspections, contractors).",
  };
}
