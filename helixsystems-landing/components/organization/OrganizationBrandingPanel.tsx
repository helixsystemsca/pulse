"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { Card } from "@/components/pulse/Card";
import { useTheme } from "@/components/theme/ThemeProvider";
import { dsFormHintClass, dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { apiFetch, refreshPulseUserFromServer } from "@/lib/api";
import { uploadTenantCompanyLogoFile } from "@/lib/companyBrandingUpload";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import type { CompanySummary } from "@/lib/pulse-session";

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
    <Card variant="secondary" padding="lg">
      <SectionHeader
        title="Organization logo"
        description="Shown in the sidebar and headers. Upload an image (max 2MB) or set a public https URL."
      />

      {err ? (
        <p className="ds-alert-critical mt-3 rounded-lg border px-3 py-2 text-sm text-ds-foreground">{err}</p>
      ) : null}
      {ok ? (
        <p className="ds-alert-success mt-3 rounded-lg border px-3 py-2 text-sm text-ds-foreground">{ok}</p>
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
            className="ds-btn-secondary px-4 py-2.5 text-sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Choose image…"}
          </button>
        </div>
      </div>

      <div className="mt-6">
        <label htmlFor="org-logo-url" className={dsLabelClass}>
          Logo URL (optional)
        </label>
        <p className={dsFormHintClass}>
          Use a direct https link instead of a file, or clear the field after uploading to rely on the uploaded file.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            id="org-logo-url"
            value={logoUrlDraft}
            onChange={(e) => setLogoUrlDraft(e.target.value)}
            placeholder="https://…"
            className={`min-w-[12rem] flex-1 ${dsInputClass}`}
          />
          <button
            type="button"
            disabled={!urlDirty || savingUrl}
            onClick={() => void saveLogoUrl()}
            className="ds-btn-solid-primary px-4 py-2.5 text-sm"
          >
            {savingUrl ? "Saving…" : "Save URL"}
          </button>
        </div>
      </div>
    </Card>
  );
}
