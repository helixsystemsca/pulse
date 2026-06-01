"use client";

import { Camera, ImagePlus, Loader2, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { useResolvedProtectedAssetSrc } from "@/lib/useResolvedProtectedAssetSrc";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

type Props = {
  itemId?: string | null;
  imageUrl?: string | null;
  pendingPreviewUrl?: string | null;
  disabled?: boolean;
  onPendingFile?: (file: File | null) => void;
  onUploadComplete?: (imageUrl: string) => void;
  uploadFile?: (file: File) => Promise<{ image_url: string }>;
};

export function InventoryItemPhotoUpload({
  itemId,
  imageUrl,
  pendingPreviewUrl,
  disabled,
  onPendingFile,
  onUploadComplete,
  uploadFile,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const resolved = useResolvedProtectedAssetSrc(imageUrl ?? null);
  const displaySrc = localPreview ?? pendingPreviewUrl ?? resolved.src;

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleFile = useCallback(
    async (file: File | null) => {
      setErr(null);
      if (!file) return;
      const ct = (file.type || "").toLowerCase();
      if (!ALLOWED.has(ct)) {
        setErr("Upload a JPEG, PNG, or WebP image.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setErr("Image too large (max 5MB).");
        return;
      }

      if (localPreview) URL.revokeObjectURL(localPreview);
      const preview = URL.createObjectURL(file);
      setLocalPreview(preview);

      if (itemId && uploadFile) {
        setBusy(true);
        try {
          const out = await uploadFile(file);
          onUploadComplete?.(out.image_url);
          onPendingFile?.(null);
        } catch (e) {
          setErr(parseClientApiError(e).message);
        } finally {
          setBusy(false);
        }
      } else {
        onPendingFile?.(file);
      }
    },
    [itemId, localPreview, onPendingFile, onUploadComplete, uploadFile],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div
          className={cn(
            "relative flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50 shadow-sm",
            busy && "opacity-70",
          )}
        >
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displaySrc} alt="" className="h-full w-full object-cover" />
          ) : resolved.loading ? (
            <span className="text-xs text-pulse-muted">Loading…</span>
          ) : (
            <span className="px-2 text-center text-xs text-pulse-muted">No photo</span>
          )}
          {busy ? (
            <span className="absolute inset-0 grid place-items-center bg-black/30">
              <Loader2 className="h-6 w-6 animate-spin text-white" aria-hidden />
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-ds-interactive-hover disabled:opacity-50"
            disabled={disabled || busy}
            onClick={() => cameraInputRef.current?.click()}
          >
            <Camera className="h-4 w-4" aria-hidden />
            Take photo
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-ds-interactive-hover disabled:opacity-50"
            disabled={disabled || busy}
            onClick={() => galleryInputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" aria-hidden />
            Upload from device
          </button>
          {itemId ? (
            <p className="text-[11px] text-pulse-muted">Photos save immediately for existing items.</p>
          ) : (
            <p className="text-[11px] text-pulse-muted">Photo uploads when you save the new item.</p>
          )}
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {err ? <p className="text-sm font-semibold text-rose-700">{err}</p> : null}
    </div>
  );
}

type ProfilePhotoProps = {
  imageUrl?: string | null;
  name: string;
  itemId?: string;
  canEdit?: boolean;
  onUploadComplete?: (imageUrl: string) => void;
  uploadFile?: (file: File) => Promise<{ image_url: string }>;
};

/** Square list-row thumbnail (90% of row height) for inventory tables and pickers. */
export function InventoryItemListThumb({
  imageUrl,
  name,
  FallbackIcon,
}: {
  imageUrl?: string | null;
  name: string;
  FallbackIcon: LucideIcon;
}) {
  const { src, loading } = useResolvedProtectedAssetSrc(imageUrl ?? null);

  return (
    <div className="flex shrink-0 self-stretch items-center py-[5%]" aria-hidden>
      <div className="aspect-square h-full max-h-16 border border-slate-200/90 bg-slate-50 dark:border-ds-border dark:bg-ds-secondary">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : loading && imageUrl?.trim() ? (
          <div className="h-full w-full animate-pulse bg-slate-100 dark:bg-ds-interactive-hover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[#2B4C7E] dark:text-sky-300">
            <FallbackIcon className="h-[42%] w-[42%] min-h-4 min-w-4" strokeWidth={1.75} />
          </span>
        )}
      </div>
    </div>
  );
}

/** Product photo on the inventory item detail drawer; empty state is tappable to upload. */
export function InventoryItemProfilePhoto({
  imageUrl,
  name,
  itemId,
  canEdit,
  onUploadComplete,
  uploadFile,
}: ProfilePhotoProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const photo = useResolvedProtectedAssetSrc(imageUrl ?? null);
  const displaySrc = localPreview ?? photo.src;
  const canUpload = Boolean(canEdit && itemId && uploadFile);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const handleFile = useCallback(
    async (file: File | null) => {
      setErr(null);
      if (!file || !itemId || !uploadFile) return;
      const ct = (file.type || "").toLowerCase();
      if (!ALLOWED.has(ct)) {
        setErr("Upload a JPEG, PNG, or WebP image.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setErr("Image too large (max 5MB).");
        return;
      }

      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(URL.createObjectURL(file));
      setBusy(true);
      try {
        const out = await uploadFile(file);
        onUploadComplete?.(out.image_url);
      } catch (e) {
        setErr(parseClientApiError(e).message);
        setLocalPreview(null);
      } finally {
        setBusy(false);
      }
    },
    [itemId, localPreview, onUploadComplete, uploadFile],
  );

  const frame = (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50 shadow-sm",
        busy && "opacity-80",
      )}
    >
      {displaySrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displaySrc} alt={name} className="aspect-[4/3] w-full object-cover" />
      ) : photo.loading && imageUrl?.trim() ? (
        <div className="flex aspect-[4/3] items-center justify-center text-sm text-pulse-muted">Loading photo…</div>
      ) : canUpload ? (
        <button
          type="button"
          className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-2 border-0 bg-slate-50 text-pulse-muted transition-colors hover:bg-slate-100/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4C7E]/40"
          disabled={busy}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-8 w-8 opacity-50" aria-hidden />
          <p className="text-sm font-semibold text-pulse-navy">No product photo</p>
          <p className="text-xs text-pulse-muted">Tap to add from your device</p>
        </button>
      ) : (
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-pulse-muted">
          <ImagePlus className="h-8 w-8 opacity-40" aria-hidden />
          <p className="text-sm font-medium">No product photo</p>
        </div>
      )}
      {busy ? (
        <span className="absolute inset-0 grid place-items-center bg-black/25">
          <Loader2 className="h-8 w-8 animate-spin text-white" aria-hidden />
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-2">
      {frame}
      {canUpload ? (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="hidden"
          onChange={(e) => {
            void handleFile(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />
      ) : null}
      {err ? <p className="text-sm font-semibold text-rose-700">{err}</p> : null}
    </div>
  );
}
