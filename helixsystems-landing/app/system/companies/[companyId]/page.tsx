"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type CompanyRow = {
  id: string;
  name: string;
  enabled_features: string[];
  user_count: number;
  is_active: boolean;
  owner_admin_id?: string | null;
};

const FEATURE_LABELS: Record<string, string> = {
  rtls_tracking: "RTLS tracking",
  work_orders: "Work orders",
  preventative_maintenance: "Preventative maintenance",
  analytics: "Analytics",
  alerts: "Alerts",
  projects: "Projects & operations",
  compliance: "Compliance",
  equipment: "Equipment (tool tracking)",
  inventory: "Inventory",
  schedule: "Schedule",
};

export default function SystemCompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = typeof params.companyId === "string" ? params.companyId : "";

  const [row, setRow] = useState<CompanyRow | null>(null);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

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
    return <p className="text-zinc-500">Invalid company.</p>;
  }

  if (loading) {
    return <p className="text-zinc-500">Loading…</p>;
  }

  if (notFound || !row) {
    return (
      <div className="space-y-4">
        <p className="text-zinc-400">Company not found.</p>
        <Link href="/system/companies" className="text-sm text-blue-400 hover:underline">
          ← Back to companies
        </Link>
      </div>
    );
  }

  const nameDirty = nameDraft.trim() !== row.name;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/system/companies" className="text-sm text-blue-400 hover:underline">
          ← Companies
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-white">Company settings</h1>
        <p className="mt-1 font-mono text-xs text-zinc-500">{row.id}</p>
      </div>

      {!row.is_active ? (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">This company is inactive.</p>
          <button
            type="button"
            onClick={() => void reactivateCompany()}
            className="mt-2 text-xs font-semibold text-amber-300 underline hover:text-amber-200"
          >
            Reactivate
          </button>
        </div>
      ) : null}

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Profile</h2>
        <div className="mt-4 grid gap-4 sm:max-w-xl">
          <div>
            <label className="text-xs font-medium uppercase text-zinc-500">Company name</label>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="min-w-[12rem] flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50"
                disabled={!row.is_active}
              />
              <button
                type="button"
                disabled={!row.is_active || !nameDirty || savingName}
                onClick={() => void saveName()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
              >
                {savingName ? "Saving…" : "Save name"}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-zinc-400">
            <span>
              Users: <strong className="text-zinc-200">{row.user_count}</strong>
            </span>
            {row.owner_admin_id ? (
              <span className="font-mono text-xs">
                Owner admin: <span className="text-zinc-300">{row.owner_admin_id}</span>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-5">
        <p className="mb-3 text-xs text-zinc-500">
          If this company has no saved feature rows yet, tenants still get the default product modules (projects, compliance,
          equipment, inventory, schedule). Checking boxes and saving persists flags in{" "}
          <span className="font-mono text-zinc-400">company_features</span>.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Features</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!row.is_active}
              onClick={() => void enableAll()}
              className="text-xs font-semibold text-blue-400 hover:underline disabled:opacity-40"
            >
              Enable all
            </button>
            <button
              type="button"
              disabled={!row.is_active}
              onClick={() => void disableAllFeats()}
              className="text-xs font-semibold text-zinc-500 hover:underline disabled:opacity-40"
            >
              Disable all
            </button>
          </div>
        </div>
        <div className="mt-4 flex max-w-2xl flex-wrap gap-3">
          {catalog.map((f) => (
            <label
              key={f}
              className={`flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-300 ${
                !row.is_active ? "cursor-not-allowed opacity-50" : "cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                className="rounded border-zinc-600"
                checked={row.enabled_features.includes(f)}
                disabled={!row.is_active}
                onChange={(e) => void toggleCompanyFeature(row.enabled_features, f, e.target.checked)}
              />
              {FEATURE_LABELS[f] ?? f}
            </label>
          ))}
        </div>
      </section>

      {row.is_active ? (
        <div className="border-t border-zinc-800 pt-6">
          <button
            type="button"
            onClick={() => void disableCompany()}
            className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-950/50"
          >
            Deactivate company
          </button>
        </div>
      ) : null}
    </div>
  );
}
