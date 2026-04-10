"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { Card } from "@/components/pulse/Card";
import { useTheme } from "@/components/theme/ThemeProvider";
import { dsFormHintClass, dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useAuthenticatedAssetSrc } from "@/hooks/useAuthenticatedAssetSrc";
import { apiFetch, refreshPulseUserFromServer } from "@/lib/api";
import { getImpersonationOverlayAccessToken } from "@/lib/impersonation-overlay-token";
import { uploadTenantCompanyBackgroundFile, uploadTenantCompanyLogoFile } from "@/lib/companyBrandingUpload";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import type { CompanySummary } from "@/lib/pulse-session";

type Props = {
  initialCompany: CompanySummary;
  onCompanyUpdated?: (c: CompanySummary) => void;
};

function HeroBackgroundPreview({ url }: { url: string | null }) {
  const src = useAuthenticatedAssetSrc(url);
  const waitingBlob = Boolean(url && !url.startsWith("http://") && !url.startsWith("https://") && !src);

  return (
    <div className="mt-4 aspect-[21/9] max-h-40 overflow-hidden rounded-lg border border-ds-border bg-ds-secondary">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob or tenant https URL
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : waitingBlob ? (
        <p className="flex h-full items-center justify-center px-4 text-center text-sm text-ds-muted">Loading preview…</p>
      ) : (
        <p className="flex h-full items-center justify-center px-4 text-center text-sm text-ds-muted">
          No background yet — upload an image or set a URL.
        </p>
      )}
    </div>
  );
}

export function OrganizationBrandingPanel({ initialCompany, onCompanyUpdated }: Props) {
  const { theme } = useTheme();
  const logoFileId = useId();
  const bgFileId = useId();
  const logoFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState(initialCompany);
  const [logoUrlDraft, setLogoUrlDraft] = useState(initialCompany.logo_url ?? "");
  const [bgUrlDraft, setBgUrlDraft] = useState(initialCompany.background_image_url ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [savingLogoUrl, setSavingLogoUrl] = useState(false);
  const [savingBgUrl, setSavingBgUrl] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    setCompany(initialCompany);
    setLogoUrlDraft(initialCompany.logo_url ?? "");
    setBgUrlDraft(initialCompany.background_image_url ?? "");
  }, [
    initialCompany.id,
    initialCompany.name,
    initialCompany.logo_url,
    initialCompany.background_image_url,
  ]);

  const syncParent = useCallback(
    (c: CompanySummary) => {
      setCompany(c);
      onCompanyUpdated?.(c);
    },
    [onCompanyUpdated],
  );

  const onLogoFile = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    setOk(null);
    setUploadingLogo(true);
    try {
      await uploadTenantCompanyLogoFile(file);
      await refreshPulseUserFromServer();
      const next: CompanySummary = { ...company, logo_url: "/api/v1/company/logo" };
      syncParent(next);
      setLogoUrlDraft(next.logo_url ?? "");
      setOk("Logo uploaded.");
      if (typeof window !== "undefined" && getImpersonationOverlayAccessToken()) {
        window.dispatchEvent(new Event("pulse-auth-change"));
      }
      if (logoFileRef.current) logoFileRef.current.value = "";
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const onBgFile = async (file: File | null) => {
    if (!file) return;
    setErr(null);
    setOk(null);
    setUploadingBg(true);
    try {
      const out = await uploadTenantCompanyBackgroundFile(file);
      await refreshPulseUserFromServer();
      const bgPath = out.background_image_url ?? "/api/v1/company/background";
      const next: CompanySummary = { ...company, background_image_url: bgPath };
      syncParent(next);
      setBgUrlDraft(bgPath);
      setOk("Header background uploaded — visible on the mobile app after refresh.");
      if (typeof window !== "undefined" && getImpersonationOverlayAccessToken()) {
        window.dispatchEvent(new Event("pulse-auth-change"));
      }
      if (bgFileRef.current) bgFileRef.current.value = "";
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setUploadingBg(false);
    }
  };

  const saveLogoUrl = async () => {
    setErr(null);
    setOk(null);
    const trimmed = logoUrlDraft.trim();
    const body = { logo_url: trimmed || null };
    setSavingLogoUrl(true);
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
      if (typeof window !== "undefined" && getImpersonationOverlayAccessToken()) {
        window.dispatchEvent(new Event("pulse-auth-change"));
      }
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSavingLogoUrl(false);
    }
  };

  const saveBgUrl = async () => {
    setErr(null);
    setOk(null);
    const trimmed = bgUrlDraft.trim();
    const body = { background_image_url: trimmed || null };
    setSavingBgUrl(true);
    try {
      const out = await apiFetch<{ background_image_url?: string | null }>("/api/v1/company/profile", {
        method: "PATCH",
        json: body,
      });
      await refreshPulseUserFromServer();
      const next: CompanySummary = {
        ...company,
        background_image_url: out.background_image_url ?? null,
      };
      syncParent(next);
      setBgUrlDraft(next.background_image_url ?? "");
      setOk("Header background URL saved.");
      if (typeof window !== "undefined" && getImpersonationOverlayAccessToken()) {
        window.dispatchEvent(new Event("pulse-auth-change"));
      }
    } catch (e) {
      setErr(parseClientApiError(e).message);
    } finally {
      setSavingBgUrl(false);
    }
  };

  const logoUrlDirty = (logoUrlDraft.trim() || null) !== (company.logo_url ?? null);
  const bgUrlDirty = (bgUrlDraft.trim() || null) !== (company.background_image_url ?? null);

  return (
    <div className="space-y-6">
      {err ? (
        <div className="ds-notification ds-notification-critical flex gap-2 px-3 py-2 text-sm text-ds-foreground">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
          <p>{err}</p>
        </div>
      ) : null}
      {ok ? (
        <div className="ds-notification ds-notification-success flex gap-2 px-3 py-2 text-sm text-ds-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ds-success" aria-hidden />
          <p>{ok}</p>
        </div>
      ) : null}

      <Card variant="secondary" padding="lg">
        <SectionHeader
          title="Organization logo"
          description="Shown in the sidebar and headers. Upload an image (max 2MB) or set a public https URL."
        />

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <CompanyLogo
            logoUrl={company.logo_url ?? null}
            companyName={company.name}
            variant={theme === "dark" ? "dark" : "light"}
            className="max-h-12"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              ref={logoFileRef}
              id={logoFileId}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="sr-only"
              tabIndex={-1}
              disabled={uploadingLogo}
              onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="ds-btn-secondary px-4 py-2.5 text-sm"
              disabled={uploadingLogo}
              onClick={() => logoFileRef.current?.click()}
            >
              {uploadingLogo ? "Uploading…" : "Choose image…"}
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
              disabled={!logoUrlDirty || savingLogoUrl}
              onClick={() => void saveLogoUrl()}
              className="ds-btn-solid-primary px-4 py-2.5 text-sm"
            >
              {savingLogoUrl ? "Saving…" : "Save URL"}
            </button>
          </div>
        </div>
      </Card>

      <Card variant="secondary" padding="lg">
        <SectionHeader
          title="Mobile app header background"
          description="Large image behind the blurred hero on the Pulse mobile app for everyone in your organization. Upload (max 2MB) or use a public https URL."
        />

        <HeroBackgroundPreview url={company.background_image_url ?? null} />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            ref={bgFileRef}
            id={bgFileId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            disabled={uploadingBg}
            onChange={(e) => void onBgFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="ds-btn-secondary px-4 py-2.5 text-sm"
            disabled={uploadingBg}
            onClick={() => bgFileRef.current?.click()}
          >
            {uploadingBg ? "Uploading…" : "Choose background image…"}
          </button>
        </div>

        <div className="mt-6">
          <label htmlFor="org-bg-url" className={dsLabelClass}>
            Background image URL (optional)
          </label>
          <p className={dsFormHintClass}>
            Set a direct https image link, or clear to remove a URL (uploaded file stays on disk until replaced).
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              id="org-bg-url"
              value={bgUrlDraft}
              onChange={(e) => setBgUrlDraft(e.target.value)}
              placeholder="https://…"
              className={`min-w-[12rem] flex-1 ${dsInputClass}`}
            />
            <button
              type="button"
              disabled={!bgUrlDirty || savingBgUrl}
              onClick={() => void saveBgUrl()}
              className="ds-btn-solid-primary px-4 py-2.5 text-sm"
            >
              {savingBgUrl ? "Saving…" : "Save URL"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
