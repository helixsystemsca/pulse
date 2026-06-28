"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Copy,
  Download,
  Loader2,
  Pencil,
  Upload,
} from "lucide-react";
import { usePulseAuth } from "@/hooks/usePulseAuth";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { sessionHasAnyRole } from "@/lib/pulse-roles";
import { TRAINING_ROUTES } from "@/lib/training/routes";
import { flashcardCertificationLabel } from "@/lib/training/training-milestone";
import {
  archiveTrainingDeck,
  duplicateTrainingDeck,
  exportTrainingDeck,
  fetchTrainingDecks,
  importTrainingDeckPack,
  renameTrainingDeck,
  type TrainingDeckSummary,
} from "@/lib/training/trainingPlatformApi";
import { FlashcardDeckValidatePanel } from "@/components/training/flashcards/FlashcardDeckValidatePanel";
import { cn } from "@/lib/cn";
import { uiCalloutWarning, uiPageDescription, uiPageStack, uiPageTitle } from "@/styles/ui-classes";

function formatUpdatedAt(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value),
    );
  } catch {
    return value;
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function FlashcardDeckManagement() {
  const { session } = usePulseAuth();
  const canManage = sessionHasAnyRole(session, "manager", "company_admin", "system_admin");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [decks, setDecks] = useState<TrainingDeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameDescription, setRenameDescription] = useState("");

  const loadDecks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchTrainingDecks(showArchived);
      setDecks(rows);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    if (canManage) void loadDecks();
    else setLoading(false);
  }, [canManage, loadDecks]);

  const onImportFile = async (file: File) => {
    setImporting(true);
    setError(null);
    try {
      const text = await file.text();
      const result = await importTrainingDeckPack(text);
      if (result.status === "failed_validation") {
        const msg = result.errors.map((e) => e.message).join("; ") || "Import validation failed";
        throw new Error(msg);
      }
      await loadDecks();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onExport = async (deck: TrainingDeckSummary) => {
    setBusyId(deck.id);
    setError(null);
    try {
      const pack = await exportTrainingDeck(deck.id);
      downloadJson(`${deck.slug}.json`, pack);
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  };

  const onDuplicate = async (deck: TrainingDeckSummary) => {
    setBusyId(deck.id);
    setError(null);
    try {
      await duplicateTrainingDeck(deck.id, { new_title: `${deck.title} (Copy)` });
      await loadDecks();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  };

  const onArchive = async (deck: TrainingDeckSummary) => {
    if (!window.confirm(`Archive "${deck.title}"? Learners will no longer see this deck.`)) return;
    setBusyId(deck.id);
    setError(null);
    try {
      await archiveTrainingDeck(deck.id);
      await loadDecks();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  };

  const startRename = (deck: TrainingDeckSummary) => {
    setRenameId(deck.id);
    setRenameTitle(deck.title);
    setRenameDescription(deck.description ?? "");
  };

  const submitRename = async () => {
    if (!renameId || !renameTitle.trim()) return;
    setBusyId(renameId);
    setError(null);
    try {
      await renameTrainingDeck(renameId, {
        title: renameTitle.trim(),
        description: renameDescription.trim() || null,
      });
      setRenameId(null);
      await loadDecks();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusyId(null);
    }
  };

  if (!canManage) {
    return (
      <div className={uiPageStack}>
        <p className={uiPageDescription}>Manager access is required to manage flashcard decks.</p>
        <Link href={TRAINING_ROUTES.flashcards} className="text-sm font-semibold text-teal-700 hover:underline">
          ← Back to flashcards
        </Link>
      </div>
    );
  }

  return (
    <div className={uiPageStack}>
      <header className="space-y-3">
        <Link
          href={TRAINING_ROUTES.flashcards}
          className="inline-flex items-center gap-1 text-sm font-medium text-ds-muted hover:text-ds-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Flashcards
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className={uiPageTitle}>Deck management</h2>
            <p className={cn(uiPageDescription, "max-w-2xl")}>
              Import, export, and maintain certification flashcard decks — CAPM, FMP, Six Sigma, Power BI, and more.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import deck
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="sr-only"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onImportFile(file);
                }}
              />
            </label>
          </div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ds-muted">
          <input
            type="checkbox"
            className="h-4 w-4 accent-teal-600"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived decks
        </label>
      </header>

      <FlashcardDeckValidatePanel />

      {error ? <div className={uiCalloutWarning}>{error}</div> : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-ds-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading decks…
        </div>
      ) : null}

      {!loading && decks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ds-border bg-ds-muted/10 p-8 text-center">
          <p className="text-sm font-semibold text-ds-foreground">No decks yet</p>
          <p className={cn(uiPageDescription, "mx-auto mt-1 max-w-md")}>
            Import a JSON deck pack to publish CAPM, FMP, or other certification flashcards.
          </p>
        </div>
      ) : null}

      {!loading && decks.length > 0 ? (
        <ul className="grid gap-4">
          {decks.map((deck) => {
            const certLabel = flashcardCertificationLabel(deck);
            const isBusy = busyId === deck.id;
            return (
              <li
                key={deck.id}
                className={cn(
                  "rounded-xl border border-ds-border bg-ds-card p-5 shadow-sm",
                  deck.status === "archived" && "opacity-70",
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400">
                        {certLabel}
                      </span>
                      {deck.status === "archived" ? (
                        <span className="rounded-full bg-ds-muted/20 px-2 py-0.5 text-[10px] font-bold uppercase text-ds-muted">
                          Archived
                        </span>
                      ) : null}
                      <span className="text-xs text-ds-muted">v{deck.deck_version}</span>
                    </div>
                    <h3 className="text-base font-semibold text-ds-foreground">{deck.title}</h3>
                    {deck.description ? (
                      <p className="text-sm text-ds-muted">{deck.description}</p>
                    ) : null}
                    <dl className="grid gap-x-6 gap-y-1 text-xs text-ds-muted sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="font-medium text-ds-foreground">Cards</dt>
                        <dd>{deck.card_count}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-ds-foreground">Sections</dt>
                        <dd>{deck.section_count}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-ds-foreground">Last updated</dt>
                        <dd>{formatUpdatedAt(deck.updated_at)}</dd>
                      </div>
                      <div>
                        <dt className="font-medium text-ds-foreground">Slug</dt>
                        <dd className="truncate font-mono">{deck.slug}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onExport(deck)}
                      className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-xs font-semibold hover:bg-ds-muted/20 disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Export
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onDuplicate(deck)}
                      className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-xs font-semibold hover:bg-ds-muted/20 disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicate
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => startRename(deck)}
                      className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-xs font-semibold hover:bg-ds-muted/20 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Rename
                    </button>
                    {deck.status !== "archived" ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onArchive(deck)}
                        className="inline-flex items-center gap-1 rounded-lg border border-ds-border px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </button>
                    ) : null}
                  </div>
                </div>

                {renameId === deck.id ? (
                  <div className="mt-4 space-y-3 rounded-lg border border-ds-border bg-ds-muted/5 p-4">
                    <label className="block text-sm">
                      <span className="font-medium text-ds-foreground">Title</span>
                      <input
                        value={renameTitle}
                        onChange={(e) => setRenameTitle(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-medium text-ds-foreground">Description</span>
                      <textarea
                        value={renameDescription}
                        onChange={(e) => setRenameDescription(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-ds-border bg-ds-card px-3 py-2 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void submitRename()}
                        disabled={isBusy || !renameTitle.trim()}
                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenameId(null)}
                        className="rounded-lg border border-ds-border px-3 py-1.5 text-sm font-semibold hover:bg-ds-muted/20"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
