"use client";

import { Camera, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { refreshPulseUserFromServer } from "@/lib/api";
import { cn } from "@/lib/cn";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { uploadProfileAvatarFile } from "@/lib/profileAvatarUpload";
import { initialsFromDisplayName } from "@/components/profile/UserProfileAvatarPreview";
import { useResolvedAvatarSrc } from "@/lib/useResolvedAvatarSrc";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

async function fileToWebpBlob(file: File, maxSizePx: number): Promise<Blob> {
  if (file.type === "image/webp") {
    // Still normalize size via canvas (keeps UX consistent and removes huge originals).
  }
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSizePx / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image conversion not supported");
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode WebP"))),
      "image/webp",
      0.86,
    );
  });
  return blob;
}

export type AvatarUploadProps = {
  userId: string;
  currentAvatarUrl: string | null | undefined;
  displayName: string | null | undefined;
  /** Tailwind size class (e.g. "h-24 w-24"). */
  size?: string;
  onUploadComplete?: (nextUrl: string) => void;
  className?: string;
};

export function AvatarUpload({
  userId,
  currentAvatarUrl,
  displayName,
  size = "h-24 w-24",
  onUploadComplete,
  className = "",
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const initials = useMemo(() => initialsFromDisplayName(displayName), [displayName]);
  const resolvedCurrent = useResolvedAvatarSrc(currentAvatarUrl ?? null);
  const displaySrc = previewUrl ?? resolvedCurrent;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const onPick = useCallback(
    async (file: File | null) => {
      if (!file) return;
      setErr(null);

      if (file.size > MAX_BYTES) {
        setErr("Max upload size is 5MB.");
        return;
      }
      if (!ALLOWED.has(file.type)) {
        setErr("Upload a JPG, PNG, or WebP image.");
        return;
      }

      setBusy(true);
      try {
        setStage("Preparing image…");
        const webp = await fileToWebpBlob(file, 512);
        if (webp.size > MAX_BYTES) {
          throw new Error("Converted image exceeds 5MB — try a smaller image.");
        }

        const localPreview = URL.createObjectURL(webp);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return localPreview;
        });

        setStage("Uploading…");
        const file = new File([webp], "profile.webp", { type: "image/webp" });
        const out = await uploadProfileAvatarFile(file);

        await refreshPulseUserFromServer();
        if (typeof window !== "undefined") window.dispatchEvent(new Event("pulse-auth-change"));
        onUploadComplete?.(out.avatar_url ?? "/api/v1/profile/avatar");
        setStage("");
      } catch (e) {
        setErr(parseClientApiError(e).message);
      } finally {
        setBusy(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onUploadComplete],
  );

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative">
        <button
          type="button"
          onClick={openPicker}
          className={cn(
            "group relative overflow-hidden rounded-full border border-ds-border bg-ds-secondary text-ds-muted ring-2 ring-ds-primary",
            size,
          )}
          aria-label="Change profile photo"
          disabled={busy}
        >
          {displaySrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displaySrc ?? ""}
              alt=""
              className={cn("h-full w-full object-cover transition-opacity", busy && "opacity-70")}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold">{initials}</span>
          )}

          <span className="pointer-events-none absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-900 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
              <Camera className="h-4 w-4" aria-hidden />
            </span>
          </span>

          {busy ? (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="inline-flex items-center justify-center rounded-full bg-black/40 p-2 text-white">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              </span>
            </span>
          ) : null}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          className="hidden"
          onChange={(e) => void onPick(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="min-w-0">
        {busy ? <p className="text-xs font-semibold text-ds-muted">{stage || "Working…"}</p> : null}
        {err ? <p className="mt-1 text-sm font-semibold text-ds-danger">{err}</p> : null}
      </div>
    </div>
  );
}

