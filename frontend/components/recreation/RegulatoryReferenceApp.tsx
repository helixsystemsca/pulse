"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, ExternalLink, Loader2, Plus, ScrollText, Search, X } from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { hasRbacPermission, isTenantFullAdminSession } from "@/lib/rbac/session-access";
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
  REGULATORY_LIBRARY_TAG,
  REGULATORY_TOPIC_CATEGORIES,
  REGULATORY_VERIFICATION_STATUSES,
  cardMatchesQuery,
  classificationTone,
  parsePulsePointers,
  serializePulsePointers,
  userKeywordTags,
  verificationTone,
  type PulsePointer,
} from "@/lib/recreation/regulatory-reference";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";
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
  requirements: string;
  keywords: string;
  pulse_pointers: PulsePointer[];
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
  requirements: "See the official source linked on this card. Do not paste copyrighted code or standard text.",
  keywords: "",
  pulse_pointers: [{ label: "", href: "" }],
};

function draftFromRow(row: OpsRecord): Draft {
  const extras = extraUrls(row);
  const pointers = parsePulsePointers(row.pulse_pointers);
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
    requirements: str(row, "requirements"),
    keywords: userKeywordTags(row.tags).join(", "),
    pulse_pointers: pointers.length ? pointers : [{ label: "", href: "" }],
  };
}

function draftPayload(d: Draft): Record<string, unknown> {
  const keywords = d.keywords
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
    requirements: d.requirements,
    pulse_pointers: serializePulsePointers(d.pulse_pointers),
    tags: [REGULATORY_LIBRARY_TAG, d.topic_category, ...keywords].filter(Boolean),
    notes: REGULATORY_DISCLAIMER,
  };
}

const HEADER_BTN = cn(
  buttonVariants({ surface: "light", intent: "accent" }),
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50",
);
const HEADER_BTN_OUTLINE = cn(
  buttonVariants({ surface: "light", intent: "secondary" }),
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50",
);

export function RegulatoryReferenceApp() {
  const session = readSession();
  const canView =
    isUserFeatureEnabled(session, "recreation_ops") &&
    (hasRbacPermission(session, "recreation_ops.view") ||
      hasRbacPermission(session, "recreation_ops.manage") ||
      isTenantFullAdminSession(session));
  const canEdit =
    isUserFeatureEnabled(session, "recreation_ops") &&
    (hasRbacPermission(session, "recreation_ops.manage") || isTenantFullAdminSession(session));

  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const qFromUrl = searchParams.get("q") ?? "";

  const [rows, setRows] = useState<OpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [q, setQ] = useState(qFromUrl);
  const [category, setCategory] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const { phase, run } = useAsyncSubmitPhase();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listOpsRecords("regulations"));
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

  const libraryRows = useMemo(() => {
    return rows.filter((row) => {
      const archived = str(row, "status") === "archived";
      if (showArchived ? !archived : archived) return false;
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
  }, [rows, category, q, showArchived]);

  const selected = useMemo(
    () => libraryRows.find((r) => r.id === selectedId) ?? rows.find((r) => r.id === selectedId) ?? null,
    [libraryRows, rows, selectedId],
  );

  const formOpen = composing || (editing && Boolean(selected));

  async function saveDraft() {
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    const creating = composing;
    try {
      await run(async () => {
        const payload = draftPayload(draft);
        if (creating) {
          payload.status = "active";
          const created = await createOpsRecord("regulations", payload);
          setComposing(false);
          setEditing(false);
          setSelectedId(created.id);
        } else if (selectedId) {
          await patchOpsRecord("regulations", selectedId, payload);
          setEditing(false);
        }
        await refresh();
      });
      setNotice(creating ? "Card created." : "Changes saved.");
    } catch (e) {
      setError(parseClientApiError(e).message || "Could not save this card.");
    }
  }

  async function archiveSelected() {
    if (!selectedId || !selected) return;
    const archived = str(selected, "status") === "archived";
    const ok = window.confirm(
      archived
        ? "Restore this card to the active library?"
        : "Archive this card? It leaves the active library. You can show archived cards later. The starter seed will not recreate it.",
    );
    if (!ok) return;
    setError(null);
    try {
      await run(async () => {
        await patchOpsRecord("regulations", selectedId, { status: archived ? "active" : "archived" });
        setEditing(false);
        if (!archived) setSelectedId(null);
        await refresh();
      });
      setNotice(archived ? "Card restored." : "Card archived.");
    } catch (e) {
      setError(parseClientApiError(e).message || "Could not update this card.");
    }
  }

  function startCreate() {
    setComposing(true);
    setEditing(false);
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setError(null);
    setNotice(null);
  }

  function cancelForm() {
    setComposing(false);
    setEditing(false);
    setError(null);
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
            <button type="button" className={HEADER_BTN} onClick={startCreate}>
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

        {notice ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
            {notice}
          </div>
        ) : null}
        {error ? <div className={cn(uiCalloutWarning)}>{error}</div> : null}

        {composing ? (
          <section className="ds-premium-panel min-h-0 overflow-y-auto p-6">
            <button type="button" className={cn(HEADER_BTN_OUTLINE, "mb-4")} onClick={cancelForm}>
              <ArrowLeft className="h-4 w-4" />
              Back to library
            </button>
            <CardForm
              draft={draft}
              setDraft={setDraft}
              phase={phase}
              onSave={() => void saveDraft()}
              onCancel={cancelForm}
              title="New reference card"
              idleLabel="Create card"
            />
          </section>
        ) : (
          <>
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1">
                  <CategoryChip label="All" active={category === "all"} onClick={() => setCategory("all")} />
                  {REGULATORY_TOPIC_CATEGORIES.map((c) => (
                    <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
                  ))}
                </div>
                <label className="inline-flex shrink-0 items-center gap-2 text-xs text-ds-muted">
                  <input
                    type="checkbox"
                    className="rounded border-ds-border"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived
                </label>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,32rem)]" data-tour="feature-workspace">
              <div className={cn(formOpen && "hidden lg:block")}>
                {loading ? (
                  <p className="flex items-center gap-2 text-sm text-ds-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading library…
                  </p>
                ) : libraryRows.length === 0 ? (
                  <div className="rounded-xl border border-ds-border bg-ds-card p-6 text-sm text-ds-muted">
                    {rows.length === 0 ? (
                      <>
                        <p className="font-medium text-ds-foreground">No guidance documents yet</p>
                        <p className="mt-2">
                          Add cards as you learn — a title, plain-language summary, official source, and whether it is
                          Law, Guidance, or Internal. Pulse does not paste code text and does not decide legal
                          requirements.
                        </p>
                        {canEdit ? (
                          <button type="button" className={cn(HEADER_BTN, "mt-4")} onClick={startCreate}>
                            <Plus className="h-4 w-4" />
                            Add guidance document
                          </button>
                        ) : null}
                      </>
                    ) : showArchived ? (
                      <p>No archived cards.</p>
                    ) : (
                      <p>No matching cards. Try another category or keyword, or add a new card.</p>
                    )}
                  </div>
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {libraryRows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(row.id);
                            setComposing(false);
                            setEditing(false);
                            setNotice(null);
                          }}
                          className={cn(
                            "flex h-full w-full flex-col rounded-xl border bg-ds-card p-4 text-left shadow-sm transition hover:border-ds-primary/40",
                            selectedId === row.id ? "border-ds-primary ring-1 ring-ds-primary/30" : "border-ds-border",
                          )}
                        >
                          <span className="flex flex-wrap gap-1">
                            <span
                              className={cn(
                                "inline-flex w-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                classificationTone(str(row, "classification")),
                              )}
                            >
                              {str(row, "classification") || "Unclassified"}
                            </span>
                            {str(row, "status") === "archived" ? (
                              <span className="inline-flex w-fit rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-700">
                                Archived
                              </span>
                            ) : null}
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
                {editing && selected ? (
                  <CardForm
                    draft={draft}
                    setDraft={setDraft}
                    phase={phase}
                    onSave={() => void saveDraft()}
                    onCancel={cancelForm}
                    title="Edit card"
                    idleLabel="Save changes"
                  />
                ) : selected ? (
                  <ArticleDetail
                    row={selected}
                    canEdit={canEdit}
                    submitPending={phase === "loading" || phase === "success"}
                    onClose={() => setSelectedId(null)}
                    onEdit={() => {
                      setDraft(draftFromRow(selected));
                      setEditing(true);
                      setNotice(null);
                    }}
                    onArchive={() => void archiveSelected()}
                  />
                ) : (
                  <p className="text-sm text-ds-muted">
                    Select a card to read the summary, official source, and Pulse pointers.
                    {canEdit ? " Company admins can edit every field, add cards, or archive ones that no longer apply." : ""}
                  </p>
                )}
              </aside>
            </div>
          </>
        )}

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
  submitPending,
  onClose,
  onEdit,
  onArchive,
}: {
  row: OpsRecord;
  canEdit: boolean;
  submitPending: boolean;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const pointers = parsePulsePointers(row.pulse_pointers);
  const extras = extraUrls(row);
  const url = str(row, "official_source_url");
  const review = str(row, "review_date").slice(0, 10);
  const archived = str(row, "status") === "archived";

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
        {archived ? (
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-stone-700">Archived</span>
        ) : null}
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
      {str(row, "requirements") ? (
        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ds-muted">Notes</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ds-foreground">{str(row, "requirements")}</p>
        </section>
      ) : null}
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
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className={HEADER_BTN} onClick={onEdit} disabled={submitPending}>
            Edit
          </button>
          <button type="button" className={HEADER_BTN_OUTLINE} onClick={onArchive} disabled={submitPending}>
            <Archive className="h-4 w-4" />
            {archived ? "Restore" : "Archive"}
          </button>
        </div>
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
  idleLabel,
}: {
  draft: Draft;
  setDraft: (d: Draft | ((prev: Draft) => Draft)) => void;
  phase: ReturnType<typeof useAsyncSubmitPhase>["phase"];
  onSave: () => void;
  onCancel: () => void;
  title: string;
  idleLabel: string;
}) {
  const cls = "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm";
  const pending = phase === "loading" || phase === "success";
  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setPointer(index: number, patch: Partial<PulsePointer>) {
    setDraft((d) => {
      const next = d.pulse_pointers.map((p, i) => (i === index ? { ...p, ...patch } : p));
      return { ...d, pulse_pointers: next };
    });
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
      <p className="text-xs text-ds-muted">
        Do not paste copyrighted code or standard text. Mark Law vs Guidance vs Internal yourself — Pulse will not invent a
        legal claim.
      </p>
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
        Notes (internal; do not paste copyrighted code)
        <textarea className={cn(cls, "mt-1 min-h-[64px]")} value={draft.requirements} onChange={(e) => set("requirements", e.target.value)} />
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
      <fieldset className="space-y-2 rounded-lg border border-ds-border p-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-ds-muted">What to do in Pulse</legend>
        {draft.pulse_pointers.map((p, i) => (
          <div key={`ptr-${i}`} className="grid gap-2 sm:grid-cols-2">
            <input
              className={cls}
              placeholder="Label (e.g. Emergency hub)"
              value={p.label}
              onChange={(e) => setPointer(i, { label: e.target.value })}
            />
            <div className="flex gap-2">
              <input
                className={cn(cls, "flex-1")}
                placeholder="/recreation/emergency"
                value={p.href}
                onChange={(e) => setPointer(i, { href: e.target.value })}
              />
              {draft.pulse_pointers.length > 1 ? (
                <button
                  type="button"
                  className="shrink-0 rounded-lg border border-ds-border px-2 text-xs"
                  onClick={() =>
                    setDraft((d) => ({ ...d, pulse_pointers: d.pulse_pointers.filter((_, idx) => idx !== i) }))
                  }
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-ds-primary"
          onClick={() => setDraft((d) => ({ ...d, pulse_pointers: [...d.pulse_pointers, { label: "", href: "" }] }))}
        >
          <Plus className="h-3.5 w-3.5" />
          Add pointer
        </button>
      </fieldset>
      <label className="block text-xs font-medium text-ds-muted">
        Search keywords (comma-separated)
        <input
          className={cn(cls, "mt-1")}
          value={draft.keywords}
          onChange={(e) => set("keywords", e.target.value)}
          placeholder="e.g. chief engineer, ice plant"
        />
      </label>
      <div className="flex flex-wrap gap-2 pt-1">
        <AsyncSubmitButton
          phase={phase}
          onClick={onSave}
          idleLabel={idleLabel}
          disabled={pending || !draft.title.trim()}
          showSuccessLabel
        />
        <button type="button" className={HEADER_BTN_OUTLINE} onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
