"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { CompanyLogo } from "@/components/branding/CompanyLogo";
import { useTheme } from "@/components/theme/ThemeProvider";
import { apiFetch } from "@/lib/api";
import { uploadSystemCompanyLogoFile } from "@/lib/companyBrandingUpload";
import {
  SYSTEM_ADMIN_FEATURE_LABELS,
  sortCatalogFeatures,
} from "@/lib/system-admin-features";
import { parseClientApiError } from "@/lib/parse-client-api-error";

type CompanyRow = {
  id: string;
  name: string;
  logo_url?: string | null;
  enabled_features: string[];
  user_count: number;
  is_active: boolean;
  owner_admin_id?: string | null;
};

const inputCls =
  "min-w-[12rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-white dark:placeholder:text-zinc-600";
const sectionCls =
  "rounded-lg border border-gray-200 bg-white/90 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50";
const labelCls = "text-xs font-medium uppercase text-gray-500 dark:text-zinc-500";
const btnPrimary =
  "rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 hover:shadow disabled:opacity-40";
const btnSecondary =
  "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

export default function SystemCompanyDetailPage() {
  const { theme } = useTheme();
  const params = useParams();
  const router = useRouter();
  const companyId = typeof params.companyId === "string" ? params.companyId : "";
  const fileInputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);

  const [row, setRow] = useState<CompanyRow | null>(null);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [logoDraft, setLogoDraft] = useState("");
  const [savingLogo, setSavingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const [co, cat] = await Promise.all([
        apiFetch<CompanyRow>(`/api/system/companies/${companyId}`),
        apiFetch<{ features: string[] }>("/api/system/features/catalog"),
      ]);
      setRow(co);
      setNameDraft(co.name);
      setLogoDraft(co.logo_url ?? "");
      setCatalog(cat.features);
    } catch {
      setNotFound(true);
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCompanyFeature = async (current: string[], feature: string, on: boolean) => {
    if (!row) return;
    const next = on ? Array.from(new Set([...current, feature])) : current.filter((x) => x !== feature);
    const updated = await apiFetch<CompanyRow>(`/api/system/companies/${row.id}`, {
      method: "PATCH",
      json: { enabled_features: next },
    });
    setRow(updated);
  };

  const enableAll = async () => {
    if (!row) return;
    const updated = await apiFetch<CompanyRow>(`/api/system/companies/${row.id}`, {
      method: "PATCH",
      json: { enabled_features: [...catalog] },
    });
    setRow(updated);
  };

  const disableAllFeats = async () => {
    if (!row) return;
    const updated = await apiFetch<CompanyRow>(`/api/system/companies/${row.id}`, {
      method: "PATCH",
      json: { enabled_features: [] },
    });
    setRow(updated);
  };

  const saveName = async () => {
    if (!row || !nameDraft.trim() || nameDraft.trim() === row.name) return;
    setSavingName(true);
    try {
      const updated = await apiFetch<CompanyRow>(`/api/system/companies/${row.id}`, {
        method: "PATCH",
        json: { name: nameDraft.trim() },
      });
      setRow(updated);
      setNameDraft(updated.name);
    } finally {
      setSavingName(false);
    }
  };

  const saveLogoUrl = async () => {
    if (!row) return;
    const trimmed = logoDraft.trim();
    const next = trimmed || null;
    if (next === (row.logo_url ?? null)) return;
    setSavingLogo(true);
    try {
      const updated = await apiFetch<CompanyRow>(`/api/system/companies/${row.id}`, {
        method: "PATCH",
        json: { logo_url: next },
      });
      setRow(updated);
      setLogoDraft(updated.logo_url ?? "");
    } finally {
      setSavingLogo(false);
    }
  };

  const onLogoFile = async (file: File | null) => {
    if (!file || !row) return;
    setUploadErr(null);
    setUploadingLogo(true);
    try {
      const updated = await uploadSystemCompanyLogoFile<CompanyRow>(row.id, file);
      setRow(updated);
      setLogoDraft(updated.logo_url ?? "");
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setUploadErr(parseClientApiError(e).message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const disableCompany = async () => {
    if (!row || !confirm("Soft-delete (deactivate) this company?")) return;
    await apiFetch(`/api/system/companies/${row.id}`, { method: "DELETE" });
    router.push("/system/companies");
    router.refresh();
  };

  const reactivateCompany = async () => {
    if (!row) return;
    const updated = await apiFetch<CompanyRow>(`/api/system/companies/${row.id}`, {
      method: "PATCH",
      json: { is_active: true },
    });
    setRow(updated);
  };

  if (!companyId) {
    return <p className="text-gray-500 dark:text-zinc-500">Invalid company.</p>;
  }

  if (loading) {
    return <p className="text-gray-500 dark:text-zinc-500">Loading…</p>;
  }

  if (notFound || !row) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600 dark:text-zinc-400">Company not found.</p>
        <Link href="/system/companies" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Back to companies
        </Link>
      </div>
    );
  }

  const nameDirty = nameDraft.trim() !== row.name;
  const logoDirty = (logoDraft.trim() || null) !== (row.logo_url ?? null);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/system/companies" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
          ← Companies
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-gray-900 dark:text-white">Company settings</h1>
        <p className="mt-1 font-mono text-xs text-gray-500 dark:text-zinc-500">{row.id}</p>
      </div>

      {!row.is_active ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">This company is inactive.</p>
          <button
            type="button"
            onClick={() => void reactivateCompany()}
            className="mt-2 text-xs font-semibold text-amber-800 underline hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200"
          >
            Reactivate
          </button>
        </div>
      ) : null}

      <section className={sectionCls}>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500">Profile</h2>
        <div className="mt-4 grid gap-4 sm:max-w-xl">
          <div>
            <label className={labelCls}>Company name</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className={inputCls}
                disabled={!row.is_active}
              />
              <button
                type="button"
                disabled={!row.is_active || !nameDirty || savingName}
                onClick={() => void saveName()}
                className={btnPrimary}
              >
                {savingName ? "Saving…" : "Save name"}
              </button>
            </div>
          </div>

          <div>
            <label className={labelCls}>Logo</label>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-500">
              Upload a file (JPEG, PNG, WebP, or GIF, max 2MB) or set a public https URL below. Upload stores the logo
              for this tenant the same way as{" "}
              <span className="font-mono text-gray-600 dark:text-zinc-400">POST /api/v1/company/logo</span>.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <CompanyLogo
                logoUrl={row.logo_url ?? null}
                companyName={row.name}
                variant={theme === "dark" ? "dark" : "light"}
                className="max-h-11"
              />
              <input
                ref={fileRef}
                id={fileInputId}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                tabIndex={-1}
                disabled={!row.is_active || uploadingLogo}
                onChange={(e) => void onLogoFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                className={btnSecondary}
                disabled={!row.is_active || uploadingLogo}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingLogo ? "Uploading…" : "Choose image…"}
              </button>
            </div>
            {uploadErr ? (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{uploadErr}</p>
            ) : null}
          </div>

          <div>
            <label className={labelCls}>Logo URL (optional)</label>
            <p className="mt-0.5 text-[11px] text-gray-500 dark:text-zinc-500">
              Public https image URL, or leave empty when using an uploaded file.
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={logoDraft}
                onChange={(e) => setLogoDraft(e.target.value)}
                placeholder="https://…"
                className={inputCls}
                disabled={!row.is_active}
              />
              <button
                type="button"
                disabled={!row.is_active || !logoDirty || savingLogo}
                onClick={() => void saveLogoUrl()}
                className={btnPrimary}
              >
                {savingLogo ? "Saving…" : "Save logo URL"}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-gray-600 dark:text-zinc-400">
            <span>
              Users: <strong className="text-gray-900 dark:text-zinc-200">{row.user_count}</strong>
            </span>
            {row.owner_admin_id ? (
              <span className="font-mono text-xs">
                Owner admin: <span className="text-gray-800 dark:text-zinc-300">{row.owner_admin_id}</span>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className={sectionCls}>
        <p className="mb-3 text-xs text-gray-500 dark:text-zinc-500">
          If this company has no saved feature rows yet, tenants still get the default product modules (projects, compliance,
          equipment, inventory, schedule). Checking boxes and saving persists flags in{" "}
          <span className="font-mono text-gray-600 dark:text-zinc-400">company_features</span>.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-500">Features</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!row.is_active}
              onClick={() => void enableAll()}
              className="text-xs font-semibold text-blue-600 hover:underline disabled:opacity-40 dark:text-blue-400"
            >
              Enable all
            </button>
            <button
              type="button"
              disabled={!row.is_active}
              onClick={() => void disableAllFeats()}
              className="text-xs font-semibold text-gray-500 hover:underline disabled:opacity-40 dark:text-zinc-500"
            >
              Disable all
            </button>
          </div>
        </div>
        <div className="mt-4 flex max-w-2xl flex-wrap gap-3">
          {sortCatalogFeatures(catalog).map((f) => (
            <label
              key={f}
              className={`flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 ${
                !row.is_active ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-gray-300 dark:border-zinc-600"
                checked={row.enabled_features.includes(f)}
                disabled={!row.is_active}
                onChange={(e) => void toggleCompanyFeature(row.enabled_features, f, e.target.checked)}
              />
              {SYSTEM_ADMIN_FEATURE_LABELS[f] ?? f}
            </label>
          ))}
        </div>
      </section>

      {row.is_active ? (
        <div className="border-t border-gray-200 pt-6 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => void disableCompany()}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-950/50"
          >
            Deactivate company
          </button>
        </div>
      ) : null}
    </div>
  );
}
