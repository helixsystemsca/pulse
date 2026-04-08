"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl, getApiBearerForUrl } from "@/lib/api";

/**
 * Resolves `avatar_url` from the API: absolute URLs pass through; same-origin API paths
 * are fetched with the same bearer rules as `apiFetch` (session + impersonation overlay)
 * and turned into a blob URL.
 */
export function useResolvedAvatarSrc(avatarUrl: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setAuthEpoch((n) => n + 1);
    window.addEventListener("pulse-auth-change", bump);
    return () => window.removeEventListener("pulse-auth-change", bump);
  }, []);

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
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const path = avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`;
    const url = `${base.replace(/\/$/, "")}${path}`;
    const token = getApiBearerForUrl(url);
    if (!token) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    let cancelled = false;
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
  }, [avatarUrl, authEpoch]);

  if (!avatarUrl) return null;
  if (avatarUrl.startsWith("http://") || avatarUrl.startsWith("https://")) return avatarUrl;
  return blobUrl;
}
