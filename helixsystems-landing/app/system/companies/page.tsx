"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { HELIX_NOREPLY_EMAIL } from "@/lib/helix-emails";
import { parseClientApiError } from "@/lib/parse-client-api-error";

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
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

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
    if (!confirm("Deactivate this company? It will be hidden from active lists; you can re-activate or permanently delete it later if it has no users.")) return;
    await apiFetch(`/api/system/companies/${companyId}`, { method: "DELETE" });
    void load();
  };

  const reactivateCompany = async (companyId: string) => {
    await apiFetch<CompanyRow>(`/api/system/companies/${companyId}`, {
      method: "PATCH",
      json: { is_active: true },
    });
    void load();
  };

  const purgeCompany = async (companyId: string, name: string, userCount: number) => {
    if (userCount > 0) return;
    if (
      !confirm(
        `Permanently delete “${name}”? This cannot be undone. Only use for empty mistake tenants (no users). Invites and features for this tenant will be removed.`,
      )
    ) {
      return;
    }
    try {
      await apiFetch(`/api/system/companies/${companyId}/purge`, {
        method: "POST",
        json: {},
      });
      void load();
    } catch (err: unknown) {
      const parsed = parseClientApiError(err);
      if (parsed.status === 404) {
        const detail = parsed.message.trim();
        if (detail === "Company not found") {
          setBootstrapFail({
            ...parsed,
            message:
              "That company id is not in the database (already purged, or stale list). Refresh the companies page and try again.",
          });
        } else if (detail === "Not Found" || /^not found$/i.test(detail)) {
          setBootstrapFail({
            ...parsed,
            message:
              "The server you are hitting does not expose POST/DELETE …/companies/{id}/purge (routing 404). Push the latest backend to the branch Render deploys, with root directory `backend` and start `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Quick check: GET /api/system/overview with no Authorization header should return 401, not 404. Until fixed, use Deactivate.",
          });
        } else {
          setBootstrapFail(parsed);
        }
      } else {
        setBootstrapFail(parsed);
      }
    }
  };

  const featurePayload = () =>
    Object.entries(selectedFeat)
      .filter(([, v]) => v)
      .map(([k]) => k);

  const submitCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteSubmitting) return;
    setInviteBanner(null);
    setBootstrapFail(null);
    const enabled_features = featurePayload();
    setInviteSubmitting(true);
    try {
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
    } catch (err: unknown) {
      setBootstrapFail(parseClientApiError(err));
    } finally {
      setInviteSubmitting(false);
    }
  };

  const submitBootstrapPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordSubmitting) return;
    setBootstrapFail(null);
    const enabled_features = featurePayload();
    setPasswordSubmitting(true);
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
      setBootstrapFail(parseClientApiError(err));
    } finally {
      setPasswordSubmitting(false);
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
          {bootstrapFail.status === 409 ? (
            <p className="mt-2 text-xs text-red-300/90">
              A pending invite for that email already exists—the first request likely created the company. Find it in the
              list, or deactivate an empty duplicate and use <strong className="text-red-200">Delete permanently</strong>.
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
                <th className="px-4 py-3 w-44 text-right">Actions</th>
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
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {r.is_active ? (
                        <button
                          type="button"
                          onClick={() => void disableCompany(r.id)}
                          className="text-xs font-semibold text-amber-400/95 hover:underline"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void reactivateCompany(r.id)}
                            className="text-xs font-semibold text-emerald-400 hover:underline"
                          >
                            Re-activate
                          </button>
                          <button
                            type="button"
                            onClick={() => void purgeCompany(r.id, r.name, r.user_count)}
                            disabled={r.user_count > 0}
                            title={
                              r.user_count > 0
                                ? "Remove all users before permanent delete"
                                : "Remove this empty tenant forever"
                            }
                            className="text-xs font-semibold text-red-400 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                          >
                            Delete permanently
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "invite" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
            {inviteSubmitting ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-zinc-950/90 px-6 backdrop-blur-sm"
                aria-busy="true"
                aria-live="polite"
              >
                <Loader2 className="h-10 w-10 animate-spin text-blue-400" aria-hidden />
                <p className="mt-4 text-center text-sm font-semibold text-zinc-100">Working on it…</p>
                <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-zinc-400">
                  Creating the tenant, storing the invite, and sending mail from your API (often a few seconds). If SMTP
                  isn’t configured, the company is still created—you’ll get the invite link in the blue banner after this
                  closes.
                </p>
              </div>
            ) : null}
            <h2 className="text-lg font-semibold text-white">Create company + invite</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Email uses the full template from the API and is sent from{" "}
              <span className="text-zinc-400">{HELIX_NOREPLY_EMAIL}</span> when SMTP is configured.
            </p>
            <form className="mt-4 space-y-4" onSubmit={(e) => void submitCreateInvite(e)}>
              {bootstrapFail ? (
                <div className="rounded-lg border border-red-800 bg-red-950/70 px-3 py-2 text-sm text-red-100">
                  <p className="font-medium">{bootstrapFail.message}</p>
                  {bootstrapFail.status === 409 ? (
                    <p className="mt-1.5 text-xs text-red-200/90">
                      An invite for that email may already exist—check the list or use{" "}
                      <strong className="text-red-100">Delete permanently</strong> on an empty duplicate.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Company name</label>
                <input
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={inviteSubmitting}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Admin email</label>
                <input
                  required
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  disabled={inviteSubmitting}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">Initial features</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {catalog.map((f) => (
                    <label
                      key={f}
                      className={`flex items-center gap-1 text-xs text-zinc-400 ${inviteSubmitting ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFeat[f] ?? false}
                        onChange={(e) => setSelectedFeat((s) => ({ ...s, [f]: e.target.checked }))}
                        disabled={inviteSubmitting}
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
                  disabled={inviteSubmitting}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {inviteSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      Creating…
                    </>
                  ) : (
                    "Create & generate invite"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {modal === "password" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-amber-900/60 bg-zinc-900 p-6 shadow-xl">
            {passwordSubmitting ? (
              <div
                className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-xl bg-zinc-950/90 px-6 backdrop-blur-sm"
                aria-busy="true"
                aria-live="polite"
              >
                <Loader2 className="h-10 w-10 animate-spin text-amber-400" aria-hidden />
                <p className="mt-4 text-center text-sm font-semibold text-zinc-100">Creating company…</p>
              </div>
            ) : null}
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
                  disabled={passwordSubmitting}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
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
                  disabled={passwordSubmitting}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Admin full name (optional)</label>
                <input
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  disabled={passwordSubmitting}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
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
                  disabled={passwordSubmitting}
                  className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm text-white disabled:opacity-50"
                />
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-zinc-500">Initial features</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {catalog.map((f) => (
                    <label
                      key={f}
                      className={`flex items-center gap-1 text-xs text-zinc-400 ${passwordSubmitting ? "pointer-events-none opacity-50" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedFeat[f] ?? false}
                        onChange={(e) => setSelectedFeat((s) => ({ ...s, [f]: e.target.checked }))}
                        disabled={passwordSubmitting}
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
                  disabled={passwordSubmitting}
                  className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-60"
                >
                  {passwordSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                      Creating…
                    </>
                  ) : (
                    "Create company & admin"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
