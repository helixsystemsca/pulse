"use client";

/**
 * Profile image from `avatar_url` (public URL or API path like `/api/v1/profile/avatar`).
 */
import { User } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

type Props = {
  avatarUrl?: string | null;
  nameFallback?: string | null;
  className?: string;
  sizeClassName?: string;
};

export function UserProfileAvatarPreview({
  avatarUrl,
  nameFallback,
  className = "",
  sizeClassName = "h-24 w-24",
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarUrl || avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const base = getApiBaseUrl();
    if (!base) {
      setBlobUrl(null);
      return;
    }
    const session = readSession();
    const token = session?.access_token;
    if (!token) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    const path = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;
    const url = `${base.replace(/\/$/, "")}${path}`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (cancelled) return;
        setBlobUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(b);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const src =
    avatarUrl?.startsWith("http://") || avatarUrl?.startsWith("https://") ? avatarUrl : blobUrl;
  const initials = (nameFallback?.trim() || "?").slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-600 ring-2 ring-white dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-300 dark:ring-[#111827] ${sizeClassName} ${className}`.trim()}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex flex-col items-center justify-center gap-0.5 text-center">
          <User className="h-8 w-8 opacity-60" strokeWidth={1.5} aria-hidden />
          <span className="text-[10px] font-bold">{initials}</span>
        </span>
      )}
    </div>
  );
}
