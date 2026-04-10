"use client";

import { useEffect, useState } from "react";
import { getApiBaseUrl, getApiBearerForUrl } from "@/lib/api";

export type ResolvedProtectedAsset = {
  /** URL safe for `<img src>` (https URL or blob). */
  src: string | null;
  /** Relative API path is being fetched with bearer auth. */
  loading: boolean;
  /** Fetch failed or missing token. */
  failed: boolean;
};

/**
 * API-stored paths (e.g. `/api/v1/equipment/.../image`) require Authorization; plain `<img src>` cannot send it.
 * Absolute http(s) URLs pass through unchanged.
 */
export function useResolvedProtectedAssetSrc(storedPath: string | null | undefined): ResolvedProtectedAsset {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFailed(false);

    if (!storedPath?.trim()) {
      setLoading(false);
      return;
    }
    const p = storedPath.trim();
    if (p.startsWith("http://") || p.startsWith("https://")) {
      setLoading(false);
      return;
    }

    const base = getApiBaseUrl();
    if (!base) {
      setLoading(false);
      setFailed(true);
      return;
    }
    const path = p.startsWith("/") ? p : `/${p}`;
    const url = `${base.replace(/\/$/, "")}${path}`;
    const bearer = getApiBearerForUrl(url);
    if (!bearer) {
      setLoading(false);
      setFailed(true);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(url, { headers: { Authorization: `Bearer ${bearer}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (cancelled) return;
        setBlobUrl(URL.createObjectURL(b));
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [storedPath]);

  if (!storedPath?.trim()) {
    return { src: null, loading: false, failed: false };
  }
  const p = storedPath.trim();
  if (p.startsWith("http://") || p.startsWith("https://")) {
    return { src: p, loading: false, failed: false };
  }
  if (blobUrl) {
    return { src: blobUrl, loading: false, failed: false };
  }
  return { src: null, loading, failed };
}
