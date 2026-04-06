"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { useTheme } from "@/components/theme/ThemeProvider";
import { apiFetch, refreshPulseUserFromServer } from "@/lib/api";
import { uploadTenantCompanyLogoFile } from "@/lib/companyBrandingUpload";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import type { CompanySummary } from "@/lib/pulse-session";

const FIELD =
  "mt-1.5 w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-pulse-navy shadow-sm placeholder:text-slate-400 focus:border-[#2B4C7E]/35 focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:border-[#374151] dark:bg-[#0F172A] dark:text-gray-100 dark:placeholder:text-gray-500";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-pulse-muted dark:text-gray-500";
const BTN =
  "rounded-xl bg-[#2B4C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#234066] disabled:opacity-50";
const BTN_SEC =
  "rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-pulse-navy shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-[#374151] dark:bg-[#1F2937] dark:text-gray-100 dark:hover:bg-[#374151]";

type Props = {
  initialCompany: CompanySummary;
  onCompanyUpdated?: (c: CompanySummary) => void;
};

export function OrganizationBrandingPanel({ initialCompany, onCompanyUpdated }: Props) {
  const { theme } = useTheme();
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState(initialCompany);
  const [logoUrlDraft, setLogoUrlDraft] = useState(initialCompany.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setCompany(initialCompany);
    setLogoUrlDraft(initialCompany.logo_url ?? "");
  }, [initialCompany.id, initialCompany.name, initialCompany.logo_url]);

  const syncParent = useCallback(
    (c: CompanySummary) => {
      setCompany(c);
      onCompanyUpdated?.(c);
    },
    [onCompanyUpdated],
  );

  const onFile = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    setOk(null);
    setUploading(true);
    try {
      await uploadTenantCompanyLogoFile(file);
      await refreshPulseUserFromServer();
      const next: CompanySummary = { ...company, logo_url: "/api/v1/company/logo" };
      syncParent(next);
      setLogoUrlDraft(next.logo_url ?? "");
      setOk("Logo uploaded.");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setUploading(false);
    }
  };

  const saveLogoUrl = async () => {
    setErr(null);
    setOk(null);
    const trimmed = logoUrlDraft.trim();
    const body = { logo_url: trimmed || null };
    setSavingUrl(true);
    try {
      const out = await apiFetch<{ logo_url?: string | null }>("/api/v1/company/profile", {
        method: "PATCH",
        json: body,
      });
      await refreshPulseUserFromServer();
      const next: CompanySummary = {
        ...company,
        logo_url: out.logo_url ?? null,
      };
      syncParent(next);
      setLogoUrlDraft(next.logo_url ?? "");
      setOk("Logo link saved.");
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSavingUrl(false);
    }
  };

  const urlDirty = (logoUrlDraft.trim() || null) !== (company.logo_url ?? null);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-[#374151] dark:bg-[#111827]/80">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-pulse-muted dark:text-gray-400">
        Organization logo
      </h2>
      <p className="mt-1 text-sm text-pulse-muted dark:text-gray-400">
        Shown in the sidebar and headers. Upload an image (max 2MB) or set a public https URL.
      </p>

      {err ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {err}
        </p>
      ) : null}
      {ok ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
          {ok}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <CompanyLogo
          logoUrl={company.logo_url ?? null}
          companyName={company.name}
          variant={theme === "dark" ? "dark" : "light"}
          className="max-h-12"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            id={fileId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            disabled={uploading}
            onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className={BTN_SEC}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Choose image…"}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="org-logo-url" className={LABEL}>
          Logo URL (optional)
        </label>
        <p className="mt-0.5 text-xs text-pulse-muted dark:text-gray-500">
          Use a direct https link instead of a file, or clear the field after uploading to rely on the uploaded file.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            id="org-logo-url"
            value={logoUrlDraft}
            onChange={(e) => setLogoUrlDraft(e.target.value)}
            placeholder="https://…"
            className={`min-w-[12rem] flex-1 ${FIELD}`}
          />
          <button type="button" disabled={!urlDirty || savingUrl} onClick={() => void saveLogoUrl()} className={BTN}>
            {savingUrl ? "Saving…" : "Save URL"}
          </button>
        </div>
      </div>
    </section>
  );
}
