"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

/**
 * Resolves `avatar_url` from the API: absolute URLs pass through; same-origin API paths
 * are fetched with the Pulse bearer token and turned into a blob URL.
 */
export function useResolvedAvatarSrc(avatarUrl: string | null | undefined): string | null {
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

  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) return avatarUrl;
  return blobUrl;
}
