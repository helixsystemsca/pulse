"use client";

import { Camera, ImagePlus, Loader2 } from "lucide-react";
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
