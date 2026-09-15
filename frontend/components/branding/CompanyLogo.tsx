"use client";

/**
 * Tenant logo from session (`company.logo_url`) with fallbacks.
 * API-relative URLs (e.g. `/api/v1/company/logo`) are loaded with the session bearer (blob URL).
 * Same-origin `/images/…` paths and public https URLs render directly.
 */
import { Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { isApiRelativeLogoUrl, isDirectDisplayLogoUrl, isHttpsLogoUrl, trimLogoUrl } from "@/lib/branding/logo-src";
import { readSession } from "@/lib/pulse-session";
import { cn } from "@/lib/cn";

const imgBase =
  "max-h-[2.25rem] w-auto max-w-[min(100%,11rem)] object-contain object-center md:max-h-[2.5rem]";
const imgBaseChrome =
  "max-h-[2.05rem] w-auto max-w-[min(100%,13.5rem)] object-contain object-center sm:max-h-[2.2rem] md:max-h-[2.35rem]";

type Props = {
  logoUrl?: string | null;
  companyName?: string | null;
  className?: string;
  /** `light`: default on white header. `dark`: system-admin sidebar (zinc). `chrome`: dark app navbar. */
  variant?: "light" | "dark" | "chrome";
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
  const [authEpoch, setAuthEpoch] = useState(0);
  const [broken, setBroken] = useState(false);
  const trimmed = trimLogoUrl(logoUrl);

  useEffect(() => {
    const bump = () => setAuthEpoch((n) => n + 1);
    window.addEventListener("pulse-auth-change", bump);
    return () => window.removeEventListener("pulse-auth-change", bump);
  }, []);

  useEffect(() => {
    setBroken(false);
  }, [trimmed]);

  useEffect(() => {
    if (!trimmed || isDirectDisplayLogoUrl(trimmed)) {
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
    const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    const url = `${base.replace(/\/$/, "")}${path}`;
    fetch(url, { cache: "no-store", headers: { Authorization: `Bearer ${token}` } })
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
  }, [trimmed, authEpoch]);

  const fallbackText = (companyName?.trim() || "Organization").slice(0, 48);
  const ring =
    variant === "dark"
      ? "border-ds-border bg-ds-secondary text-ds-foreground ring-1 ring-ds-border"
      : variant === "chrome"
        ? "border-white/20 bg-white/10 text-white ring-1 ring-white/15"
        : "border-slate-200/80 bg-slate-50 text-pulse-navy ring-1 ring-slate-200/60";
  const imgClass = variant === "chrome" ? imgBaseChrome : imgBase;
  const frameClass =
    variant === "chrome"
      ? "rounded-md bg-white px-2 py-1 shadow-sm ring-1 ring-white/25"
      : "";

  const directSrc =
    trimmed && !broken && isDirectDisplayLogoUrl(trimmed) ? trimmed : null;
  const blobSrc = !broken && blobUrl ? blobUrl : null;
  const displaySrc = directSrc ?? blobSrc;

  if (displaySrc) {
    return (
      <span className={cn("inline-flex max-w-full items-center justify-center", frameClass, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tenant-supplied URL, static public path, or blob */}
        <img
          src={displaySrc}
          alt={fallbackText}
          className={imgClass}
          loading={variant === "chrome" ? "eager" : "lazy"}
          referrerPolicy={directSrc && isHttpsLogoUrl(directSrc) ? "no-referrer" : undefined}
          onError={() => setBroken(true)}
        />
      </span>
    );
  }

  if (trimmed && isApiRelativeLogoUrl(trimmed)) {
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
