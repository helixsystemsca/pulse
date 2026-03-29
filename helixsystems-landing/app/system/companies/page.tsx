"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type CompanyRow = {
  id: string;
  name: string;
  enabled_features: string[];
  user_count: number;
  is_active: boolean;
};

export default function SystemCompaniesPage() {
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [selectedFeat, setSelectedFeat] = useState<Record<string, boolean>>({});
  const catalogKey = useMemo(() => catalog.join(","), [catalog]);
  useEffect(() => {
    if (!catalog.length) return;
    setSelectedFeat((prev) => {
      const next = { ...prev };
      for (const f of catalog) if (!(f in next)) next[f] = false;
      return next;
    });
  }, [catalogKey, catalog]);
  const [invitePath, setInvitePath] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, cat] = await Promise.all([
        apiFetch<CompanyRow[]>(`/api/system/companies?include_inactive=true&q=${encodeURIComponent(q)}`),
        apiFetch<{ features: string[] }>("/api/system/features/catalog"),
      ]);
      setRows(list);
      setCatalog(cat.features);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleCompanyFeature = async (companyId: string, current: string[], feature: string, on: boolean) => {
    const next = on ? Array.from(new Set([...current, feature])) : current.filter((x) => x !== feature);
    await apiFetch(`/api/system/companies/${companyId}`, { method: "PATCH", json: { enabled_features: next } });
    void load();
  };

  const disableCompany = async (companyId: string) => {
    if (!confirm("Soft-delete (deactivate) this company?")) return;
    await apiFetch(`/api/system/companies/${companyId}`, { method: "DELETE" });
    void load();
  };

  const enableAll = async (companyId: string) => {
    await apiFetch(`/api/system/companies/${companyId}`, { method: "PATCH", json: { enabled_features: [...catalog] } });
    void load();
  };

  const disableAllFeats = async (companyId: string) => {
    await apiFetch(`/api/system/companies/${companyId}`, { method: "PATCH", json: { enabled_features: [] } });
    void load();
  };

  const submitCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvitePath(null);
    const enabled_features = Object.entries(selectedFeat)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const res = await apiFetch<{ company_id: string; invite_link_path: string }>(
      "/api/system/companies/create-and-invite",
      {
        method: "POST",
        json: {
          company_name: companyName,
          admin_email: adminEmail,
          enabled_features,
        },
      },
    );
    setInvitePath(res.invite_link_path);
    setModal(false);
    setCompanyName("");
    setAdminEmail("");
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Companies</h1>
          <p className="mt-1 text-sm text-zinc-500">Create tenants, features, and invites.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setInvitePath(null);
            setModal(true);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Create company + invite
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter by name…"
          className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-600/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Search
        </button>
      </div>

      {invitePath ? (
        <div className="rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-3 text-sm text-blue-200">
          <p className="font-medium">Invite link path (append to your app origin):</p>
          <code className="mt-2 block break-all text-xs text-blue-100">{invitePath}</code>
        </div>
      ) : null}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Features</th>
                <th className="px-4 py-3">Toggles</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
              {rows.map((r) => (
                <tr key={r.id} className={r.is_active ? "" : "opacity-50"}>
                  <td className="px-4 py-3 font-medium text-white">
                    {r.name}
                    <div className="text-xs font-normal text-zinc-500">{r.id}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{r.user_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {r.enabled_features.map((f) => (
                        <span key={f} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-md flex-wrap gap-2">
                      {catalog.map((f) => (
                        <label key={f} className="flex items-center gap-1 text-xs text-zinc-400">
                          <input
                            type="checkbox"
                            checked={r.enabled_features.includes(f)}
                            onChange={(e) => void toggleCompanyFeature(r.id, r.enabled_features, f, e.target.checked)}
                          />
                          {f}
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-xs text-blue-400 hover:underline"
                        onClick={() => void enableAll(r.id)}
                      >
                        Enable all
                      </button>
                      <button
                        type="button"
                        className="text-xs text-zinc-500 hover:underline"
                        onClick={() => void disableAllFeats(r.id)}
                      >
                        Disable all
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {r.is_active ? (
                      <button
                        type="button"
                        onClick={() => void disableCompany(r.id)}
                        className="text-xs text-red-400 hover:underline"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Create company + invite</h2>
            <form className="mt-4 space-y-4" onSubmit={(e) => void submitCreateInvite(e)}>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Company name</label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Admin email</label>
                <input
                  required
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">Initial features</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {catalog.map((f) => (
                    <label key={f} className="flex items-center gap-1 text-xs text-zinc-400">
                      <input
                        type="checkbox"
                        checked={selectedFeat[f] ?? false}
                        onChange={(e) => setSelectedFeat((s) => ({ ...s, [f]: e.target.checked }))}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                  Create &amp; generate invite
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
