"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, Plus, ScrollText, Search, X } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { hasRbacPermission } from "@/lib/rbac/session-access";
import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { readSession } from "@/lib/pulse-session";
import {
  createOpsRecord,
  listOpsRecords,
  patchOpsRecord,
  type OpsRecord,
} from "@/lib/recreation/opsService";
import {
  REGULATORY_CLASSIFICATIONS,
  REGULATORY_DISCLAIMER,
  REGULATORY_TOPIC_CATEGORIES,
  REGULATORY_VERIFICATION_STATUSES,
  cardMatchesQuery,
  classificationTone,
  parsePulsePointers,
  verificationTone,
} from "@/lib/recreation/regulatory-reference";
import { cn } from "@/lib/cn";
import { uiCalloutWarning } from "@/styles/ui-classes";

function str(row: OpsRecord | Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function extraUrls(row: OpsRecord): string[] {
  const raw = row.external_references;
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter((u) => /^https?:\/\//i.test(u));
}

type Draft = {
  title: string;
  topic_category: string;
  classification: string;
  verification_status: string;
  review_date: string;
  applicability: string;
  summary: string;
  authority: string;
  regulation_name: string;
  official_source_name: string;
  official_source_url: string;
  external_references: string;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  topic_category: "Other",
  classification: "Regulator guidance",
  verification_status: "Unverified",
  review_date: "",
  applicability: "",
  summary: "",
  authority: "",
  regulation_name: "",
  official_source_name: "",
  official_source_url: "",
  external_references: "",
};

function draftFromRow(row: OpsRecord): Draft {
  const extras = extraUrls(row);
  return {
    title: row.title,
    topic_category: str(row, "topic_category") || "Other",
    classification: str(row, "classification") || "Regulator guidance",
    verification_status: str(row, "verification_status") || "Unverified",
    review_date: str(row, "review_date").slice(0, 10),
    applicability: str(row, "applicability"),
    summary: str(row, "summary"),
    authority: str(row, "authority"),
    regulation_name: str(row, "regulation_name"),
    official_source_name: str(row, "official_source_name"),
    official_source_url: str(row, "official_source_url"),
    external_references: extras.join("\n"),
  };
}

function draftPayload(d: Draft): Record<string, unknown> {
  return {
    title: d.title.trim(),
    topic_category: d.topic_category,
    classification: d.classification,
    verification_status: d.verification_status,
    review_date: d.review_date || null,
    applicability: d.applicability,
    summary: d.summary,
    description: d.summary,
    authority: d.authority,
    regulation_name: d.regulation_name,
    official_source_name: d.official_source_name,
    official_source_url: d.official_source_url.trim() || null,
    external_references: d.external_references
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    requirements:
      "See the official source linked on this card. Do not paste copyrighted code or standard text.",
    status: "active",
    notes: REGULATORY_DISCLAIMER,
  };
}

export function RegulatoryReferenceApp() {
  const session = readSession();
  const canView =
    isUserFeatureEnabled(session, "recreation_ops") &&
    (hasRbacPermission(session, "recreation_ops.view") || hasRbacPermission(session, "recreation_ops.manage"));
  const canEdit = isUserFeatureEnabled(session, "recreation_ops") && hasRbacPermission(session, "recreation_ops.manage");

  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const qFromUrl = searchParams.get("q") ?? "";

  const [rows, setRows] = useState<OpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(qFromUrl);
  const [category, setCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const { phase, run } = useAsyncSubmitPhase();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listOpsRecords("regulations", { status: "active" }));
    } catch (e) {
      setError(parseClientApiError(e).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (qFromUrl) setQ(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    if (focusId && rows.some((r) => r.id === focusId)) {
      setSelectedId(focusId);
      setComposing(false);
    }
  }, [focusId, rows]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (category !== "all" && str(row, "topic_category") !== category) return false;
      return cardMatchesQuery(
        {
          title: row.title,
          summary: str(row, "summary"),
          applicability: str(row, "applicability"),
          topic_category: str(row, "topic_category"),
          classification: str(row, "classification"),
          official_source_name: str(row, "official_source_name"),
          authority: str(row, "authority"),
          regulation_name: str(row, "regulation_name"),
          tags: row.tags,
        },
        q,
      );
    });
  }, [rows, category, q]);

  const selected = useMemo(
    () => filtered.find((r) => r.id === selectedId) ?? rows.find((r) => r.id === selectedId) ?? null,
    [filtered, rows, selectedId],
  );

  async function saveDraft() {
    if (!draft.title.trim()) return;
    await run(async () => {
      const payload = draftPayload(draft);
      if (composing) {
        const created = await createOpsRecord("regulations", payload);
        setComposing(false);
        setSelectedId(created.id);
      } else if (selectedId) {
        await patchOpsRecord("regulations", selectedId, payload);
        setEditing(false);
      }
      await refresh();
    });
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-ds-border bg-ds-secondary/30 p-8 text-center">
        <ScrollText className="mx-auto h-10 w-10 text-ds-muted" />
        <h1 className="mt-4 text-lg font-semibold text-ds-foreground">Codes & Guidance</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Enable <strong>My Role</strong> and grant My Role permissions to open the regulatory reference library.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Codes & Guidance"
        description="Plain-language reference cards with official public sources. Not legal advice — confirm the current wording on the linked page."
        icon={ScrollText}
        actions={
          canEdit ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-ds-primary px-3 py-2 text-sm font-semibold text-white"
              onClick={() => {
                setComposing(true);
                setEditing(false);
                setSelectedId(null);
                setDraft(EMPTY_DRAFT);
              }}
            >
              <Plus className="h-4 w-4" />
              New card
            </button>
          ) : null
        }
      />
      <PageBody>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950" data-tour="feature-toolbar">
          {REGULATORY_DISCLAIMER}
        </div>

        {error ? <div className={cn(uiCalloutWarning)}>{error}</div> : null}

        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
            <input
              type="search"
              className="w-full rounded-lg border border-ds-border bg-ds-bg py-2.5 pl-9 pr-3 text-base sm:text-sm"
              placeholder="Search chief engineer, pool code, building code, OH&S…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search Codes & Guidance"
            />
          </div>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <CategoryChip label="All" active={category === "all"} onClick={() => setCategory("all")} />
            {REGULATORY_TOPIC_CATEGORIES.map((c) => (
              <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]" data-tour="feature-workspace">
          <div>
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-ds-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
              </p>
            ) : filtered.length === 0 ? (
              <p className="rounded-xl border border-ds-border bg-ds-card p-6 text-sm text-ds-muted">
                No matching cards. Try another category or keyword, or ask from Ops Copilot.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {filtered.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(row.id);
                        setComposing(false);
                        setEditing(false);
                      }}
                      className={cn(
                        "flex h-full w-full flex-col rounded-xl border bg-ds-card p-4 text-left shadow-sm transition hover:border-ds-primary/40",
                        selectedId === row.id ? "border-ds-primary ring-1 ring-ds-primary/30" : "border-ds-border",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          classificationTone(str(row, "classification")),
                        )}
                      >
                        {str(row, "classification") || "Unclassified"}
                      </span>
                      <h2 className="mt-2 text-sm font-semibold leading-snug text-ds-foreground">{row.title}</h2>
                      <p className="mt-1 text-xs text-ds-muted">{str(row, "topic_category") || "Other"}</p>
                      <p className="mt-2 line-clamp-3 text-sm text-ds-foreground/90">{str(row, "summary")}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="rounded-xl border border-ds-border bg-ds-card p-4 lg:sticky lg:top-4">
            {composing || (editing && selected) ? (
              <CardForm
                draft={draft}
                setDraft={setDraft}
                phase={phase}
                onSave={() => void saveDraft()}
                onCancel={() => {
                  setComposing(false);
                  setEditing(false);
                }}
                title={composing ? "New reference card" : "Edit card"}
              />
            ) : selected ? (
              <ArticleDetail
                row={selected}
                canEdit={canEdit}
                onClose={() => setSelectedId(null)}
                onEdit={() => {
                  setDraft(draftFromRow(selected));
                  setEditing(true);
                }}
              />
            ) : (
              <p className="text-sm text-ds-muted">Select a card to read the summary, official source, and Pulse pointers.</p>
            )}
          </aside>
        </div>

        <p className="text-xs text-ds-muted">
          Related:{" "}
          <Link href="/recreation/emergency" className="text-ds-primary hover:underline">
            Emergency
          </Link>
          {" · "}
          <Link href="/recreation/copilot" className="text-ds-primary hover:underline">
            Ops Copilot
          </Link>
          {" · "}
          <Link href="/recreation/knowledge" className="text-ds-primary hover:underline">
            Knowledge Base
          </Link>
        </p>
      </PageBody>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
        active ? "border-ds-primary bg-ds-primary text-white" : "border-ds-border bg-ds-card text-ds-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ArticleDetail({
  row,
  canEdit,
  onClose,
  onEdit,
}: {
  row: OpsRecord;
  canEdit: boolean;
  onClose: () => void;
  onEdit: () => void;
}) {
  const pointers = parsePulsePointers(row.pulse_pointers);
  const extras = extraUrls(row);
  const url = str(row, "official_source_url");
  const review = str(row, "review_date").slice(0, 10);

  return (
    <article className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold leading-snug text-ds-foreground">{row.title}</h2>
        <button type="button" className="rounded p-1 text-ds-muted hover:bg-ds-muted/20" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", classificationTone(str(row, "classification")))}>
          {str(row, "classification") || "Unclassified"}
        </span>
        <span className="rounded-full bg-ds-muted/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-ds-muted">
          {str(row, "topic_category") || "Other"}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", verificationTone(str(row, "verification_status")))}>
          {str(row, "verification_status") || "Unverified"}
          {review ? ` · ${review}` : ""}
        </span>
      </div>
      {str(row, "applicability") ? (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Applicability</h3>
          <p className="mt-1 text-sm text-ds-foreground">{str(row, "applicability")}</p>
        </section>
      ) : null}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Summary</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ds-foreground">{str(row, "summary")}</p>
      </section>
      <section className="rounded-lg border border-ds-border bg-ds-bg p-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Official source</h3>
        <p className="mt-1 text-sm font-medium text-ds-foreground">
          {str(row, "official_source_name") || str(row, "authority") || "See linked page"}
        </p>
        {str(row, "regulation_name") ? <p className="mt-0.5 text-xs text-ds-muted">{str(row, "regulation_name")}</p> : null}
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-ds-primary hover:underline">
            Open official page <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <p className="mt-2 text-xs text-ds-muted">No public URL on file — search the organization named above.</p>
        )}
        {extras.length ? (
          <ul className="mt-2 space-y-1 text-xs">
            {extras.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="break-all text-ds-primary hover:underline">
                  {u}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      {pointers.length ? (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">What to do in Pulse</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {pointers.map((p) => (
              <li key={`${p.href}-${p.label}`}>
                <Link href={p.href} className="font-medium text-ds-primary hover:underline">
                  {p.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {canEdit ? (
        <button type="button" className="text-sm font-semibold text-ds-primary hover:underline" onClick={onEdit}>
          Edit card
        </button>
      ) : null}
      {str(row, "notes") ? <p className="text-xs text-ds-muted">{str(row, "notes")}</p> : null}
    </article>
  );
}

function CardForm({
  draft,
  setDraft,
  phase,
  onSave,
  onCancel,
  title,
}: {
  draft: Draft;
  setDraft: (d: Draft | ((prev: Draft) => Draft)) => void;
  phase: ReturnType<typeof useAsyncSubmitPhase>["phase"];
  onSave: () => void;
  onCancel: () => void;
  title: string;
}) {
  const cls = "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm";
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <h2 className="text-sm font-semibold text-ds-foreground">{title}</h2>
      <label className="block text-xs font-medium text-ds-muted">
        Title
        <input className={cn(cls, "mt-1")} value={draft.title} onChange={(e) => set("title", e.target.value)} required />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Topic category
        <select className={cn(cls, "mt-1")} value={draft.topic_category} onChange={(e) => set("topic_category", e.target.value)}>
          {REGULATORY_TOPIC_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Classification
        <select className={cn(cls, "mt-1")} value={draft.classification} onChange={(e) => set("classification", e.target.value)}>
          {REGULATORY_CLASSIFICATIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Verification
        <select
          className={cn(cls, "mt-1")}
          value={draft.verification_status}
          onChange={(e) => set("verification_status", e.target.value)}
        >
          {REGULATORY_VERIFICATION_STATUSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Review date
        <input className={cn(cls, "mt-1")} type="date" value={draft.review_date} onChange={(e) => set("review_date", e.target.value)} />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Applicability
        <textarea className={cn(cls, "mt-1 min-h-[64px]")} value={draft.applicability} onChange={(e) => set("applicability", e.target.value)} />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Plain-language summary (do not paste copyrighted code)
        <textarea className={cn(cls, "mt-1 min-h-[96px]")} value={draft.summary} onChange={(e) => set("summary", e.target.value)} />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Official source name
        <input className={cn(cls, "mt-1")} value={draft.official_source_name} onChange={(e) => set("official_source_name", e.target.value)} />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Official URL
        <input className={cn(cls, "mt-1")} value={draft.official_source_url} onChange={(e) => set("official_source_url", e.target.value)} />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Authority
        <input className={cn(cls, "mt-1")} value={draft.authority} onChange={(e) => set("authority", e.target.value)} />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Instrument name
        <input className={cn(cls, "mt-1")} value={draft.regulation_name} onChange={(e) => set("regulation_name", e.target.value)} />
      </label>
      <label className="block text-xs font-medium text-ds-muted">
        Additional public URLs (one per line)
        <textarea
          className={cn(cls, "mt-1 min-h-[64px]")}
          value={draft.external_references}
          onChange={(e) => set("external_references", e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2 pt-1">
        <AsyncSubmitButton phase={phase} onClick={onSave} idleLabel="Save card" />
        <button type="button" className="rounded-lg border border-ds-border px-3 py-2 text-sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
