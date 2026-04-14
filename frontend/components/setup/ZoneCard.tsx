"use client";

import { Loader2, MapPin, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { ZoneOut } from "@/lib/setup-api";

const cardBase =
  "rounded-md border border-ds-border bg-ds-primary p-5 shadow-[var(--ds-shadow-card)]";

const FIELD =
  "mt-1.5 w-full rounded-md border border-ds-border bg-ds-primary px-3 py-2 text-sm text-ds-foreground shadow-[var(--ds-shadow-card)] placeholder:text-ds-muted focus:outline-none focus:ring-1 focus:ring-ds-border/50 dark:bg-ds-secondary";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-ds-muted";
const ICON_BTN =
  "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-ds-muted transition-colors hover:bg-ds-interactive-hover hover:text-ds-foreground";
const ICON_BTN_DANGER =
  "inline-flex shrink-0 items-center justify-center rounded-md p-1.5 text-ds-muted transition-colors hover:bg-red-500/10 hover:text-ds-danger";
const BTN_PRIMARY =
  "rounded-md bg-ds-accent px-3 py-1.5 text-xs font-semibold text-ds-accent-foreground shadow-[var(--ds-shadow-card)] transition-colors hover:bg-ds-accent/90 disabled:opacity-50";
const BTN_GHOST =
  "rounded-md border border-ds-border bg-ds-secondary/60 px-3 py-1.5 text-xs font-semibold text-ds-foreground hover:bg-ds-interactive-hover";

export function ZoneCard({
  zone,
  gatewayCount,
  onUpdate,
  onDelete,
}: {
  zone: ZoneOut;
  gatewayCount: number;
  onUpdate: (body: { name: string; description: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(zone.name);
  const [draftDesc, setDraftDesc] = useState(zone.description ?? "");
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);

  useEffect(() => {
    if (!editing) {
      setDraftName(zone.name);
      setDraftDesc(zone.description ?? "");
    }
  }, [zone.id, zone.name, zone.description, editing]);

  const startEdit = () => {
    setDraftName(zone.name);
    setDraftDesc(zone.description ?? "");
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraftName(zone.name);
    setDraftDesc(zone.description ?? "");
  };

  const save = async () => {
    const name = draftName.trim();
    if (!name) return;
    setBusy("save");
    try {
      await onUpdate({ name, description: draftDesc.trim() || null });
      setEditing(false);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    try {
      await onDelete();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cardBase}>
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-ds-secondary text-ds-foreground">
          <MapPin className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            {editing ? (
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <label className={LABEL}>Name</label>
                  <input
                    className={FIELD}
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className={LABEL}>Description</label>
                  <input
                    className={FIELD}
                    value={draftDesc}
                    onChange={(e) => setDraftDesc(e.target.value)}
                    placeholder="Optional"
                    autoComplete="off"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    className={BTN_PRIMARY}
                    disabled={busy !== null || !draftName.trim()}
                    onClick={() => void save()}
                  >
                    {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Save"}
                  </button>
                  <button type="button" className={BTN_GHOST} disabled={busy !== null} onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ds-foreground">{zone.name}</h3>
                  {zone.description ? (
                    <p className="mt-1 text-sm text-ds-muted">{zone.description}</p>
                  ) : (
                    <p className="mt-1 text-sm italic text-ds-muted/80">No description</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className={ICON_BTN}
                    aria-label={`Edit zone ${zone.name}`}
                    disabled={busy !== null}
                    onClick={startEdit}
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    className={ICON_BTN_DANGER}
                    aria-label={`Delete zone ${zone.name}`}
                    disabled={busy !== null}
                    onClick={() => void remove()}
                  >
                    {busy === "delete" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 border-t border-ds-border pt-4 text-sm text-ds-muted">
        <span className="font-medium text-ds-foreground">{gatewayCount}</span> gateway
        {gatewayCount === 1 ? "" : "s"} assigned to this zone
      </div>
    </div>
  );
}
