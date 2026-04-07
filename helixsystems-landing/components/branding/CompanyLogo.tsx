"use client";

/**
 * Tenant logo from session (`company.logo_url`) with fallbacks.
 * API-relative URLs (e.g. `/api/v1/company/logo`) are loaded with the session bearer (blob URL).
 */
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { readSession } from "@/lib/pulse-session";

const imgBase =
  "max-h-[2.25rem] w-auto max-w-[min(100%,11rem)] object-contain object-center md:max-h-[2.5rem]";

type Props = {
  logoUrl?: string | null;
  companyName?: string | null;
  className?: string;
  /** `light`: default on white header. `dark`: system-admin sidebar (zinc). */
  variant?: "light" | "dark";
  /** When false, text fallback is icon-only (narrow sidebar). */
  showName?: boolean;
};

export function CompanyLogo({
  logoUrl,
  companyName,
  className = "",
  variant = "light",
  showName = true,
}: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!logoUrl || logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
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
    const path = logoUrl.startsWith("/") ? logoUrl : `/${logoUrl}`;
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
  }, [logoUrl]);

  const fallbackText = (companyName?.trim() || "Organization").slice(0, 48);
  const ring =
    variant === "dark"
      ? "border-zinc-700 bg-zinc-900 text-zinc-200 ring-1 ring-zinc-700"
      : "border-slate-200/80 bg-slate-50 text-pulse-navy ring-1 ring-slate-200/60";

  const external = logoUrl?.startsWith("http://") || logoUrl?.startsWith("https://");

  if (external && logoUrl) {
    return (
      <span className={`inline-flex max-w-full items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant-supplied arbitrary URL */}
        <img src={logoUrl} alt="" className={imgBase} loading="lazy" referrerPolicy="no-referrer" />
      </span>
    );
  }

  if (blobUrl) {
    return (
      <span className={`inline-flex max-w-full items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- blob from authenticated fetch */}
        <img src={blobUrl} alt="" className={imgBase} />
      </span>
    );
  }

  if (logoUrl && logoUrl.startsWith("/api")) {
    return (
      <span
        className={`inline-flex h-9 max-h-9 min-w-[2.25rem] items-center justify-center rounded-md border px-2 ${ring} ${className}`}
        title="Loading logo…"
      >
        <Building2 className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
      </span>
    );
  }

  if (!showName) {
    return (
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${ring} ${className}`}
        title={fallbackText}
      >
        <Building2 className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-80" aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={`flex h-9 max-h-9 min-w-0 max-w-[14rem] items-center gap-2 rounded-md border px-2.5 py-1 ${ring} ${className}`}
      title={fallbackText}
    >
      <Building2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      <span className="truncate font-headline text-sm font-bold leading-tight">{fallbackText}</span>
    </span>
  );
}
