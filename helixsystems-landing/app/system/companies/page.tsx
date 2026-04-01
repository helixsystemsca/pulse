"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { HELIX_NOREPLY_EMAIL } from "@/lib/helix-emails";

type CompanyRow = {
  id: string;
  name: string;
  enabled_features: string[];
  user_count: number;
  is_active: boolean;
  owner_admin_id?: string | null;
};

type ModalMode = "invite" | "password";

export default function SystemCompaniesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [catalog, setCatalog] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalMode | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
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
  const [inviteBanner, setInviteBanner] = useState<{ path: string; emailSent: boolean } | null>(null);
  const [bootstrapOk, setBootstrapOk] = useState<{ companyId: string; adminEmail: string } | null>(null);
  const [bootstrapFail, setBootstrapFail] = useState<{
    message: string;
    status?: number;
    requestUrl?: string;
  } | null>(null);
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

  const pulseAppOrigin = (
    process.env.NEXT_PUBLIC_PULSE_APP_URL ?? "https://pulse.helixsystems.ca"
  ).replace(/\/$/, "");

  const openModal = (mode: ModalMode) => {
    setInviteBanner(null);
    setBootstrapOk(null);
    setBootstrapFail(null);
    setAdminPassword("");
    setAdminFullName("");
    setModal(mode);
  };

  const disableCompany = async (companyId: string) => {
    if (!confirm("Soft-delete (deactivate) this company?")) return;
    await apiFetch(`/api/system/companies/${companyId}`, { method: "DELETE" });
    void load();
  };

  const featurePayload = () =>
    Object.entries(selectedFeat)
      .filter(([, v]) => v)
      .map(([k]) => k);

  const submitCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteBanner(null);
    const enabled_features = featurePayload();
    const res = await apiFetch<{
      company_id: string;
      invite_link_path: string;
      invite_email_sent?: boolean;
    }>(
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
    setInviteBanner({
      path: res.invite_link_path,
      emailSent: Boolean(res.invite_email_sent),
    });
    setModal(null);
    setCompanyName("");
    setAdminEmail("");
    void load();
  };

  const submitBootstrapPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBootstrapFail(null);
    const enabled_features = featurePayload();
    try {
      const res = await apiFetch<{ company_id: string; company_admin_id: string }>(
        "/api/system/companies/bootstrap-legacy",
        {
          method: "POST",
          json: {
            company_name: companyName,
            admin_email: adminEmail,
            admin_password: adminPassword,
            admin_full_name: adminFullName.trim() || null,
            enabled_features,
          },
        },
      );
      setBootstrapOk({ companyId: res.company_id, adminEmail });
      setBootstrapFail(null);
      setModal(null);
      setCompanyName("");
      setAdminEmail("");
      setAdminPassword("");
      setAdminFullName("");
      void load();
    } catch (err: unknown) {
      let msg = "Request failed";
      let status: number | undefined;
      let requestUrl: string | undefined;
      if (err && typeof err === "object") {
        if ("status" in err && typeof (err as { status: unknown }).status === "number") {
          status = (err as { status: number }).status;
        }
        if (
          "requestUrl" in err &&
          typeof (err as { requestUrl: unknown }).requestUrl === "string"
        ) {
          requestUrl = (err as { requestUrl: string }).requestUrl;
        }
        if ("body" in err) {
          const body = (err as { body?: { detail?: unknown } }).body;
          const d = body?.detail;
          if (typeof d === "string") msg = d;
          else if (Array.isArray(d) && d[0] && typeof d[0] === "object" && "msg" in d[0]) {
            msg = String((d[0] as { msg: unknown }).msg);
          }
        }
      }
      if (err instanceof Error && msg === "Request failed") {
        msg = err.message;
      }
      setBootstrapFail({ message: msg, status, requestUrl });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Companies</h1>
          <p className="mt-1 text-sm text-zinc-500">Create tenants, features, and invites.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openModal("password")}
            className="rounded-lg border border-amber-700/80 bg-amber-950/50 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-900/40"
          >
            Quick create (password, no email)
          </button>
          <button
            type="button"
            onClick={() => openModal("invite")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Create company + invite
          </button>
        </div>
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

      {inviteBanner ? (
        <div className="rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-3 text-sm text-blue-200">
          <p className="font-medium">Company admin invite</p>
          <p className="mt-1 text-xs text-blue-300/90">
            {inviteBanner.emailSent ? (
              <>
                An email was sent to the new admin from <strong className="text-blue-100">{HELIX_NOREPLY_EMAIL}</strong>{" "}
                (if SMTP is configured on the API).
              </>
            ) : (
              <>
                No invite email was sent—configure SMTP on the API to deliver from{" "}
                <strong className="text-blue-100">{HELIX_NOREPLY_EMAIL}</strong>, or share the link below manually.
              </>
            )}
          </p>
          <p className="mt-2 text-[10px] uppercase tracking-wide text-blue-400/80">Full URL</p>
          <code className="mt-0.5 block break-all text-xs text-blue-100">
            {pulseAppOrigin}
            {inviteBanner.path}
          </code>
        </div>
      ) : null}

      {bootstrapOk ? (
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100">
          <p className="font-medium">Company created without email.</p>
          <p className="mt-1 text-emerald-200/90">
            Log in as <strong className="text-white">{bootstrapOk.adminEmail}</strong> using the password you set. Company
            id: <code className="text-xs text-emerald-200">{bootstrapOk.companyId}</code>
          </p>
        </div>
      ) : null}

      {bootstrapFail ? (
        <div className="rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          <p className="font-medium text-red-100">{bootstrapFail.message}</p>
          {bootstrapFail.status === 403 ? (
            <p className="mt-2 text-xs text-red-300/90">
              Set <code className="text-red-100">ALLOW_PASSWORD_COMPANY_BOOTSTRAP=true</code> on the API host and redeploy.
            </p>
          ) : null}
          {bootstrapFail.status === 404 ? (
            <div className="mt-2 space-y-1.5 text-xs text-red-300/90">
              <p>
                A 404 here is usually <strong className="text-red-200">not</strong> your Vercel env format: the app calls{" "}
                <code className="text-red-100">/api/system/...</code> on your Render host. The service at that URL is missing
                those routes (wrong service name, old deploy, or Render root/start command not running this API).
              </p>
              {bootstrapFail.requestUrl ? (
                <p className="break-all">
                  Request was: <code className="text-[11px] text-red-100">{bootstrapFail.requestUrl}</code>
                </p>
              ) : null}
              <p>
                On Render: redeploy from the branch that has system admin routes, set <strong>Root Directory</strong> to{" "}
                <code className="text-red-100">backend</code>, run{" "}
                <code className="text-red-100">uvicorn app.main:app --host 0.0.0.0 --port $PORT</code>. A working server
                should return <strong>401</strong> (not 404) for{" "}
                <code className="text-red-100">GET /api/system/overview</code> without a token.
              </p>
            </div>
          ) : null}
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
                <th className="px-4 py-3">Enabled features</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
              {rows.map((r) => (
                <tr
                  key={r.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/system/companies/${r.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/system/companies/${r.id}`);
                    }
                  }}
                  className={`cursor-pointer transition-colors hover:bg-zinc-900/70 ${
                    r.is_active ? "" : "opacity-60"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-white">
                    <span className="text-blue-300">{r.name}</span>
                    <div className="text-xs font-normal text-zinc-500">{r.id}</div>
                    <p className="mt-0.5 text-[11px] text-zinc-600">Click for features &amp; settings</p>
                  </td>
                  <td className="px-4 py-3 text-zinc-400">{r.user_count}</td>
                  <td className="px-4 py-3">
                    {r.enabled_features.length === 0 ? (
                      <span className="text-xs text-zinc-600">None</span>
                    ) : (
                      <div className="flex max-w-md flex-wrap gap-1">
                        {r.enabled_features.map((f) => (
                          <span key={f} className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_active ? (
                      <span className="rounded-full bg-emerald-950/80 px-2 py-0.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-800/60">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-500">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.is_active ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void disableCompany(r.id);
                        }}
                        className="text-xs font-semibold text-red-400 hover:underline"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "invite" ? (
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
                  onClick={() => setModal(null)}
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

      {modal === "password" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-amber-900/60 bg-zinc-900 p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-amber-50">Quick create (no email)</h2>
            <p className="mt-1 text-xs text-amber-200/70">
              Creates the company and a company admin you can log in with immediately. Requires{" "}
              <code className="text-amber-100">ALLOW_PASSWORD_COMPANY_BOOTSTRAP=true</code> on the API.
            </p>
            {bootstrapFail ? (
              <div className="mt-4 rounded-lg border border-red-800 bg-red-950/70 px-3 py-2 text-sm text-red-100">
                <p className="font-medium">{bootstrapFail.message}</p>
                {bootstrapFail.status === 403 ? (
                  <p className="mt-1.5 text-xs text-red-200/90">
                    Set <code className="text-red-100">ALLOW_PASSWORD_COMPANY_BOOTSTRAP=true</code> on the API and redeploy.
                  </p>
                ) : null}
                {bootstrapFail.status === 404 ? (
                  <div className="mt-1.5 space-y-1 text-xs text-red-200/90">
                    <p>Render is not serving <code className="text-red-100">/api/system/*</code> (wrong deploy or start command).</p>
                    {bootstrapFail.requestUrl ? (
                      <p className="break-all text-[11px]">
                        URL: <code className="text-red-100">{bootstrapFail.requestUrl}</code>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
            <form className="mt-4 space-y-4" onSubmit={(e) => void submitBootstrapPassword(e)}>
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
                <label className="text-xs font-medium uppercase text-zinc-500">Admin email (login)</label>
                <input
                  required
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Admin full name (optional)</label>
                <input
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Password (min 8 characters)</label>
                <input
                  required
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
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
                  onClick={() => setModal(null)}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500"
                >
                  Create company &amp; admin
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
