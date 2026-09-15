/** Codes & Guidance — topic taxonomy shared by the regulatory library UI. */

export const REGULATORY_TOPIC_CATEGORIES = [
  "Chief Engineer",
  "OH&S",
  "Building Code",
  "Interior Health / Pools",
  "Refrigeration / TSBC",
  "Fire",
  "Electrical",
  "Playground",
  "Chemicals",
  "Emergency",
  "Other",
] as const;

export type RegulatoryTopicCategory = (typeof REGULATORY_TOPIC_CATEGORIES)[number];

export const REGULATORY_CLASSIFICATIONS = [
  "Law/Regulation",
  "Regulator guidance",
  "Municipal policy",
  "Industry standard",
  "Best practice",
  "Internal note",
] as const;

export type RegulatoryClassification = (typeof REGULATORY_CLASSIFICATIONS)[number];

export const REGULATORY_VERIFICATION_STATUSES = [
  "Unverified",
  "Needs municipal confirmation",
  "Reviewed",
] as const;

export type RegulatoryVerificationStatus = (typeof REGULATORY_VERIFICATION_STATUSES)[number];

export const REGULATORY_DISCLAIMER =
  "Reference information only — not legal advice and not a municipal compliance determination. Pulse does not reproduce copyrighted code or standards. Confirm current wording on the official source before relying on it for a decision.";

export const REGULATORY_LIBRARY_TAG = "regulatory-reference";
export const REGULATORY_SEED_TAG = "vernon-starter";

export type PulsePointer = { label: string; href: string };

export function isSystemRegulationTag(tag: string): boolean {
  const t = tag.trim();
  return t === REGULATORY_LIBRARY_TAG || t === REGULATORY_SEED_TAG || t.startsWith("seed-key:");
}

export function userKeywordTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags
    .map(String)
    .map((t) => t.trim())
    .filter((t) => t && !isSystemRegulationTag(t) && !(REGULATORY_TOPIC_CATEGORIES as readonly string[]).includes(t));
}

export function serializePulsePointers(rows: PulsePointer[]): PulsePointer[] {
  const out: PulsePointer[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const label = String(row.label || "").trim();
    const href = String(row.href || "").trim();
    if (!label || !href) continue;
    const key = `${label}\0${href}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, href });
  }
  return out;
}

export function classificationTone(classification: string): string {
  switch (classification) {
    case "Law/Regulation":
      return "bg-rose-50 text-rose-900 border-rose-200";
    case "Regulator guidance":
      return "bg-sky-50 text-sky-900 border-sky-200";
    case "Municipal policy":
      return "bg-violet-50 text-violet-900 border-violet-200";
    case "Industry standard":
      return "bg-amber-50 text-amber-900 border-amber-200";
    case "Internal note":
      return "bg-stone-100 text-stone-800 border-stone-300";
    default:
      return "bg-emerald-50 text-emerald-900 border-emerald-200";
  }
}

export function verificationTone(status: string): string {
  if (status === "Reviewed") return "bg-emerald-50 text-emerald-900";
  if (status === "Needs municipal confirmation") return "bg-amber-50 text-amber-950";
  return "bg-ds-muted/20 text-ds-muted";
}

export function parsePulsePointers(raw: unknown): PulsePointer[] {
  if (!Array.isArray(raw)) return [];
  const out: PulsePointer[] = [];
  for (const item of raw) {
    if (item && typeof item === "object" && "label" in item && "href" in item) {
      const label = String((item as PulsePointer).label || "").trim();
      const href = String((item as PulsePointer).href || "").trim();
      if (label && href) out.push({ label, href });
    }
  }
  return out;
}

export function cardMatchesQuery(
  card: {
    title?: string | null;
    summary?: string | null;
    applicability?: string | null;
    topic_category?: string | null;
    classification?: string | null;
    official_source_name?: string | null;
    authority?: string | null;
    regulation_name?: string | null;
    tags?: unknown;
  },
  query: string,
): boolean {
  const q = query.trim().toLowerCase().replace(/oh\s*&\s*s/g, "ohs").replace(/&/g, " ");
  if (!q) return true;
  const tags = Array.isArray(card.tags) ? card.tags.map(String).join(" ") : "";
  const hay = [
    card.title,
    card.summary,
    card.applicability,
    card.topic_category,
    card.classification,
    card.official_source_name,
    card.authority,
    card.regulation_name,
    tags,
  ]
    .map((v) => String(v || "").toLowerCase().replace(/oh\s*&\s*s/g, "ohs"))
    .join(" ");
  return q.split(/\s+/).filter(Boolean).every((tok) => hay.includes(tok));
}
