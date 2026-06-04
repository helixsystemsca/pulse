"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PremiumModal } from "@/components/ui/premium-modal";
import { QR_RESOURCE_TYPE_OPTIONS } from "@/lib/qr/qr-resource-types";
import {
  createQrResource,
  fetchQrResourceOptions,
  patchQrResource,
  type QrResourceRow,
} from "@/lib/qr/qrResourceService";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { buttonVariants } from "@/styles/button-variants";
import { cn } from "@/lib/cn";

const PRIMARY = cn(buttonVariants({ surface: "light", intent: "accent" }), "px-4 py-2 text-sm font-bold");
const SECONDARY = cn(buttonVariants({ surface: "light", intent: "secondary" }), "px-4 py-2 text-sm font-semibold");
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-pulse-navy dark:border-ds-border dark:bg-ds-secondary dark:text-gray-100";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted";

type Props = {
  open: boolean;
  onClose: () => void;
  apiCompany: string | null;
  edit?: QrResourceRow | null;
  initialResourceType?: string;
  initialResourceId?: string;
  initialName?: string;
  onSaved: (row: QrResourceRow) => void;
};

export function QrResourceWizard({
  open,
  onClose,
  apiCompany,
  edit,
  initialResourceType,
  initialResourceId,
  initialName,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState(QR_RESOURCE_TYPE_OPTIONS[0]!.value);
  const [resourceId, setResourceId] = useState("");
  const [guestEnabled, setGuestEnabled] = useState(false);
  const [guestLevel, setGuestLevel] = useState<"none" | "read_only">("read_only");
  const [options, setOptions] = useState<{ id: string; label: string; subtitle: string | null }[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(edit?.name ?? initialName ?? "");
    setDescription(edit?.description ?? "");
    setResourceType(
      (edit?.resource_type as typeof resourceType) ??
        (initialResourceType as typeof resourceType) ??
        QR_RESOURCE_TYPE_OPTIONS[0]!.value,
    );
    setResourceId(edit?.resource_id ?? initialResourceId ?? "");
    setGuestEnabled(edit?.guest_access_enabled ?? false);
    setGuestLevel(edit?.guest_access_level === "read_only" ? "read_only" : "read_only");
    setError(null);
  }, [open, edit]);

  useEffect(() => {
    if (!open || !apiCompany) return;
    let cancelled = false;
    setOptionsLoading(true);
    void fetchQrResourceOptions(apiCompany, resourceType)
      .then((items) => {
        if (!cancelled) setOptions(items);
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, apiCompany, resourceType]);

  async function save() {
    if (!name.trim() || !resourceId) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        resource_type: resourceType,
        resource_id: resourceId,
        guest_access_enabled: guestEnabled,
        guest_access_level: guestEnabled ? guestLevel : "none",
      };
      const row = edit
        ? await patchQrResource(apiCompany, edit.id, body)
        : await createQrResource(apiCompany, body);
      onSaved(row);
      onClose();
    } catch (e) {
      setError(parseClientApiError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PremiumModal
      open={open}
      onClose={onClose}
      title={edit ? "Edit QR code" : "Generate QR code"}
      subtitle="Link a Panorama resource to a scannable QR URL."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className={SECONDARY} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={PRIMARY}
            disabled={busy || !name.trim() || !resourceId}
            onClick={() => void save()}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </>
            ) : edit ? (
              "Save changes"
            ) : (
              "Generate QR"
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        <label className="block space-y-1">
          <span className={LABEL}>QR name</span>
          <input className={INPUT} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        </label>
        <label className="block space-y-1">
          <span className={LABEL}>Description</span>
          <textarea
            className={cn(INPUT, "min-h-[72px] resize-y")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="block space-y-1">
          <span className={LABEL}>Resource type</span>
          <select
            className={INPUT}
            value={resourceType}
            onChange={(e) => {
              setResourceType(e.target.value as typeof resourceType);
              setResourceId("");
            }}
            disabled={busy}
          >
            {QR_RESOURCE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className={LABEL}>Linked resource</span>
          {optionsLoading ? (
            <p className="text-sm text-pulse-muted">Loading options…</p>
          ) : (
            <select
              className={INPUT}
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              disabled={busy || options.length === 0}
            >
              <option value="">Select resource…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                  {o.subtitle ? ` — ${o.subtitle}` : ""}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5 dark:border-ds-border">
          <input
            type="checkbox"
            className="mt-1"
            checked={guestEnabled}
            onChange={(e) => setGuestEnabled(e.target.checked)}
            disabled={busy}
          />
          <span>
            <span className="block text-sm font-semibold text-pulse-navy dark:text-gray-100">Guest access</span>
            <span className="block text-xs text-pulse-muted">
              Allow unauthenticated read-only access to limited resource details.
            </span>
          </span>
        </label>
        {guestEnabled ? (
          <label className="block space-y-1">
            <span className={LABEL}>Guest access level</span>
            <select
              className={INPUT}
              value={guestLevel}
              onChange={(e) => setGuestLevel(e.target.value as "none" | "read_only")}
              disabled={busy}
            >
              <option value="read_only">Read only</option>
              <option value="none">None</option>
            </select>
          </label>
        ) : null}
      </div>
    </PremiumModal>
  );
}
