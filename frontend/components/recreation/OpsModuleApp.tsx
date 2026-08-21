"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Building2,
  ClipboardList,
  Link2,
  Loader2,
  Megaphone,
  Plus,
  ScrollText,
  Search,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { PageBody } from "@/components/ui/PageBody";
import { PageHeader } from "@/components/ui/PageHeader";
import { AsyncSubmitButton } from "@/components/ui/AsyncSubmitButton";
import { useAsyncSubmitPhase } from "@/hooks/useAsyncSubmitPhase";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { hasRbacPermission } from "@/lib/rbac/session-access";
import { isUserFeatureEnabled } from "@/lib/features/tenant-features";
import { readSession } from "@/lib/pulse-session";
import {
  getOpsModule,
  opsEntityLabel,
  type OpsEntityType,
  type OpsFieldDef,
  type OpsModuleDef,
} from "@/lib/recreation/ops-modules";
import {
  addOpsLink,
  createOpsRecord,
  deleteOpsRecord,
  listOpsRecords,
  listOpsRevisions,
  patchOpsRecord,
  removeOpsLink,
  type OpsRecord,
  type OpsRevision,
} from "@/lib/recreation/opsService";
import { cn } from "@/lib/cn";
import { uiCalloutWarning } from "@/styles/ui-classes";

const ICONS = {
  "book-open": BookOpen,
  users: Users,
  wrench: Wrench,
  "scroll-text": ScrollText,
  building: Building2,
  clipboard: ClipboardList,
  megaphone: Megaphone,
} as const;

function emptyForm(mod: OpsModuleDef): Record<string, unknown> {
  const out: Record<string, unknown> = { title: "", status: "active", tags: [], notes: "", description: "" };
  for (const f of mod.fields) {
    if (f.key in out) continue;
    if (f.type === "tags" || f.type === "json-list") out[f.key] = [];
    else if (f.type === "checkbox") out[f.key] = false;
    else if (f.type === "select" && f.options?.length) out[f.key] = f.options[0];
    else out[f.key] = "";
  }
  return out;
}

function tagsToString(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join(", ");
  return typeof v === "string" ? v : "";
}

function stringToTags(v: string): string[] {
  return v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listToString(v: unknown): string {
  if (Array.isArray(v)) return v.map(String).join("\n");
  return typeof v === "string" ? v : "";
}

function stringToList(v: string): string[] {
  return v
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: OpsFieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const cls =
    "w-full rounded-lg border border-ds-border bg-ds-bg px-3 py-2 text-sm text-ds-foreground disabled:opacity-60";
  if (field.type === "textarea" || field.type === "json-list") {
    return (
      <textarea
        className={cn(cls, "min-h-[88px]")}
        value={field.type === "json-list" ? listToString(value) : String(value ?? "")}
        placeholder={field.placeholder}
        disabled={disabled}
        onChange={(e) =>
          onChange(field.type === "json-list" ? stringToList(e.target.value) : e.target.value)
        }
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        className={cls}
        value={String(value ?? "")}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "tags") {
    return (
      <input
        className={cls}
        value={tagsToString(value)}
        placeholder={field.placeholder ?? "Comma-separated"}
        disabled={disabled}
        onChange={(e) => onChange(stringToTags(e.target.value))}
      />
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  }
  if (field.type === "date") {
    return (
      <input
        type="date"
        className={cls}
        value={String(value ?? "").slice(0, 10)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      />
    );
  }
  return (
    <input
      className={cls}
      value={String(value ?? "")}
      placeholder={field.placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

type Props = { entityType: OpsEntityType };

export function OpsModuleApp({ entityType }: Props) {
  const mod = getOpsModule(entityType);
  const Icon = ICONS[mod.icon as keyof typeof ICONS] ?? ClipboardList;
  const session = readSession();
  const canView =
    isUserFeatureEnabled(session, "recreation_ops") &&
    (hasRbacPermission(session, "recreation_ops.view") || hasRbacPermission(session, "recreation_ops.manage"));
  const canEdit =
    isUserFeatureEnabled(session, "recreation_ops") && hasRbacPermission(session, "recreation_ops.manage");

  const [rows, setRows] = useState<OpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const searchParams = useSearchParams();
  const focusId = searchParams.get("id");
  const [selectedId, setSelectedId] = useState<string | null>(focusId);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>(() => emptyForm(mod));
  const [revisions, setRevisions] = useState<OpsRevision[]>([]);
  const [linkType, setLinkType] = useState<OpsEntityType>(mod.linkableTypes[0] ?? "facilities");
  const [linkTargets, setLinkTargets] = useState<OpsRecord[]>([]);
  const [linkTargetId, setLinkTargetId] = useState("");
  const { phase, run } = useAsyncSubmitPhase();

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listOpsRecords(entityType, { q: q.trim() || undefined });
      setRows(list);
    } catch (e) {
      setError(parseClientApiError(e).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, q]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (focusId && rows.some((r) => r.id === focusId)) {
      setSelectedId(focusId);
      setCreating(false);
    }
  }, [focusId, rows]);

  useEffect(() => {
    if (!selectedId || entityType !== "knowledge") {
      setRevisions([]);
      return;
    }
    void listOpsRevisions(entityType, selectedId)
      .then(setRevisions)
      .catch(() => setRevisions([]));
  }, [entityType, selectedId]);

  useEffect(() => {
    if (!creating && !selectedId) return;
    void listOpsRecords(linkType)
      .then((list) => {
        setLinkTargets(list);
        setLinkTargetId(list[0]?.id ?? "");
      })
      .catch(() => setLinkTargets([]));
  }, [linkType, creating, selectedId]);

  function openCreate() {
    setCreating(true);
    setSelectedId(null);
    setForm(emptyForm(mod));
  }

  function openEdit(row: OpsRecord) {
    setCreating(false);
    setSelectedId(row.id);
    const next = emptyForm(mod);
    for (const f of mod.fields) {
      next[f.key] = row[f.key] ?? next[f.key];
    }
    setForm(next);
  }

  async function save() {
    await run(async () => {
      if (creating) {
        const created = await createOpsRecord(entityType, form);
        setCreating(false);
        setSelectedId(created.id);
      } else if (selectedId) {
        await patchOpsRecord(entityType, selectedId, form);
      }
      await refresh();
    });
  }

  async function remove() {
    if (!selectedId || !confirm(`Delete this ${mod.singular.toLowerCase()}?`)) return;
    await deleteOpsRecord(entityType, selectedId);
    setSelectedId(null);
    setCreating(false);
    await refresh();
  }

  async function linkRelated() {
    if (!selectedId || !linkTargetId) return;
    await addOpsLink(entityType, selectedId, linkType, linkTargetId);
    await refresh();
  }

  async function unlink(linkId: string) {
    if (!selectedId) return;
    await removeOpsLink(entityType, selectedId, linkId);
    await refresh();
  }

  if (!canView) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-ds-border bg-ds-secondary/30 p-8 text-center">
        <Icon className="mx-auto h-10 w-10 text-ds-muted" />
        <h1 className="mt-4 text-lg font-semibold text-ds-foreground">{mod.label}</h1>
        <p className="mt-2 text-sm text-ds-muted">
          Enable <strong>Recreation Ops</strong> on the tenant contract and grant recreation_ops permissions to use this
          module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mod.label}
        description={mod.description}
        icon={Icon}
        actions={
          canEdit ? (
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-ds-primary px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              New {mod.singular}
            </button>
          ) : null
        }
      />

      <PageBody>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ds-muted" />
            <input
              className="w-full rounded-lg border border-ds-border bg-ds-bg py-2 pl-9 pr-3 text-sm"
              placeholder={`Search ${mod.label.toLowerCase()}…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        {error ? <div className={cn(uiCalloutWarning, "mb-4")}>{error}</div> : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
          <div className="rounded-xl border border-ds-border bg-ds-card overflow-hidden">
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-ds-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="p-6 text-sm text-ds-muted">No records yet. Create one to start building this knowledge base.</p>
            ) : (
              <ul className="divide-y divide-ds-border">
                {rows.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className={cn(
                        "w-full px-4 py-3 text-left hover:bg-ds-muted/10",
                        selectedId === row.id && "bg-ds-primary/5",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ds-foreground">{row.title}</p>
                          <p className="mt-0.5 text-xs text-ds-muted">
                            {row.status}
                            {typeof row.category === "string" ? ` · ${row.category}` : ""}
                            {typeof row.authority === "string" && row.authority ? ` · ${row.authority}` : ""}
                          </p>
                        </div>
                        {(row.links?.length ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-ds-muted">
                            <Link2 className="h-3 w-3" />
                            {row.links.length}
                          </span>
                        ) : null}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-ds-border bg-ds-card p-4">
            {!creating && !selected ? (
              <p className="text-sm text-ds-muted">Select a record or create a new one.</p>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ds-foreground">
                  {creating ? `New ${mod.singular}` : `Edit ${mod.singular}`}
                </h3>
                {mod.fields.map((field) =>
                  field.type === "checkbox" ? (
                    <FieldInput
                      key={field.key}
                      field={field}
                      value={form[field.key]}
                      disabled={!canEdit}
                      onChange={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                    />
                  ) : (
                    <label key={field.key} className="block space-y-1">
                      <span className="text-xs font-medium text-ds-muted">{field.label}</span>
                      <FieldInput
                        field={field}
                        value={form[field.key]}
                        disabled={!canEdit}
                        onChange={(v) => setForm((f) => ({ ...f, [field.key]: v }))}
                      />
                    </label>
                  ),
                )}

                {canEdit ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <AsyncSubmitButton phase={phase} onClick={() => void save()} idleLabel="Save" />
                    {!creating && selectedId ? (
                      <button
                        type="button"
                        onClick={() => void remove()}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-3 py-2 text-sm text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {!creating && selected ? (
                  <div className="mt-4 space-y-2 border-t border-ds-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Relationships</p>
                    <ul className="space-y-1 text-xs">
                      {(selected.links ?? []).map((l) => {
                        const otherType = l.from_id === selected.id ? l.to_type : l.from_type;
                        const otherId = l.from_id === selected.id ? l.to_id : l.from_id;
                        return (
                          <li key={l.id} className="flex items-center justify-between gap-2 rounded bg-ds-muted/10 px-2 py-1.5">
                            <span>
                              {opsEntityLabel(otherType)} · {otherId.slice(0, 8)}…
                            </span>
                            {canEdit ? (
                              <button type="button" className="text-rose-600" onClick={() => void unlink(l.id)}>
                                Remove
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                      {(selected.links ?? []).length === 0 ? (
                        <li className="text-ds-muted">No linked records yet.</li>
                      ) : null}
                    </ul>
                    {canEdit ? (
                      <div className="flex flex-wrap gap-2">
                        <select
                          className="rounded-lg border border-ds-border bg-ds-bg px-2 py-1.5 text-xs"
                          value={linkType}
                          onChange={(e) => setLinkType(e.target.value as OpsEntityType)}
                        >
                          {mod.linkableTypes.map((t) => (
                            <option key={t} value={t}>
                              {opsEntityLabel(t)}
                            </option>
                          ))}
                        </select>
                        <select
                          className="min-w-0 flex-1 rounded-lg border border-ds-border bg-ds-bg px-2 py-1.5 text-xs"
                          value={linkTargetId}
                          onChange={(e) => setLinkTargetId(e.target.value)}
                        >
                          {linkTargets.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="rounded-lg border border-ds-border px-2 py-1.5 text-xs font-medium"
                          onClick={() => void linkRelated()}
                          disabled={!linkTargetId}
                        >
                          Link
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {entityType === "knowledge" && revisions.length > 0 ? (
                  <div className="mt-4 space-y-1 border-t border-ds-border pt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ds-muted">Revision history</p>
                    <ul className="space-y-1 text-xs text-ds-muted">
                      {revisions.map((r) => (
                        <li key={r.id}>
                          Rev {r.revision} · {new Date(r.created_at).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-ds-muted">
          Related modules:{" "}
          {mod.linkableTypes.map((t, i) => (
            <span key={t}>
              {i > 0 ? " · " : ""}
              <Link href={`/recreation/${t}`} className="text-ds-primary hover:underline">
                {opsEntityLabel(t)}s
              </Link>
            </span>
          ))}
        </p>
      </PageBody>
    </div>
  );
}
