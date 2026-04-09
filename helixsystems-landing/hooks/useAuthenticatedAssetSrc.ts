"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

/**
 * Public https URLs are returned as-is; API-relative paths use an authenticated blob URL
 * (same pattern as `CompanyLogo`).
 */
export function useAuthenticatedAssetSrc(url: string | null | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const bump = () => setAuthEpoch((n) => n + 1);
    window.addEventListener("pulse-auth-change", bump);
    return () => window.removeEventListener("pulse-auth-change", bump);
  }, []);

  useEffect(() => {
    if (!url) {
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
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
    const path = url.startsWith("/") ? url : `/${url}`;
    const fullUrl = `${base.replace(/\/$/, "")}${path}`;
    fetch(fullUrl, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${token}` },
    })
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
  }, [url, authEpoch]);

  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return blobUrl;
}
