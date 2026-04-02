"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, refreshSessionWithToken } from "@/lib/api";
import { parseClientApiError } from "@/lib/parse-client-api-error";
import { readSession } from "@/lib/pulse-session";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  company_id: string | null;
  company_name: string | null;
  is_active: boolean;
  last_login: string | null;
};

type PendingInviteRow = {
  invite_id: string;
  email: string;
  role: string;
  company_id: string;
  company_name: string | null;
  expires_at: string;
};

type UsersDirectory = {
  users: UserRow[];
  pending_invites: PendingInviteRow[];
};

export default function SystemUsersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiFetch<UsersDirectory>(
        `/api/system/users?limit=200&q=${encodeURIComponent(q)}`,
      );
      setRows(data.users ?? []);
      setPendingInvites(data.pending_invites ?? []);
    } catch (e: unknown) {
      setRows([]);
      setPendingInvites([]);
      setLoadError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    void load();
  }, [load]);

  const impersonate = async (userId: string) => {
    const res = await apiFetch<{ access_token: string }>(`/api/system/users/${userId}/impersonate`, {
      method: "POST",
    });
    const s = readSession();
    await refreshSessionWithToken(res.access_token, s?.remember ?? true);
    router.push("/overview");
  };

  const requestReset = async (userId: string) => {
    setResetLink(null);
    const res = await apiFetch<{ reset_link_path: string }>(`/api/system/users/${userId}/reset-password`, {
      method: "POST",
    });
    setResetLink(res.reset_link_path);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Users</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Tenant accounts (impersonate company admins and others) and pending invites that have not finished signup yet.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          <p className="font-medium">{loadError}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, name, company…"
          className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-600/30 px-3 py-2 text-sm text-white placeholder:text-zinc-500"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-zinc-600 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Search
        </button>
      </div>

      {resetLink ? (
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          <p className="font-medium">Reset link path (share securely; single-use):</p>
          <code className="mt-2 block break-all text-xs">{resetLink}</code>
        </div>
      ) : null}

      {loading ? (
        <p className="text-zinc-500">Loading…</p>
      ) : (
        <div className="space-y-10">
          <div>
            <h2 className="text-sm font-semibold text-zinc-300">Tenant users</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Only people who have completed signup appear here. Use <strong className="text-zinc-400">Impersonate</strong> to
              open Pulse as a company admin or other tenant user.
            </p>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No tenant user accounts yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                  <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Last login</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
                    {rows.map((r) => (
                      <tr key={r.id} className={r.is_active ? "" : "opacity-50"}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{r.full_name || "—"}</div>
                          <div className="text-xs text-zinc-500">{r.email}</div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{r.role}</td>
                        <td className="px-4 py-3 text-zinc-400">{r.company_name || "—"}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{r.last_login || "—"}</td>
                        <td className="space-x-2 px-4 py-3">
                          {r.role !== "system_admin" && r.company_id ? (
                            <button
                              type="button"
                              onClick={() => void impersonate(r.id)}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              Impersonate
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void requestReset(r.id)}
                            className="text-xs text-zinc-400 hover:underline"
                          >
                            Reset link
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-zinc-300">Pending invites</h2>
            <p className="mt-1 text-xs text-zinc-500">
              These emails have an open invite but have not created a login yet—there is no account to impersonate until they
              complete the link in their email (or you use quick-create with password on Companies).
            </p>
            {pendingInvites.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No unused, non-expired invites.</p>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
                  <thead className="bg-zinc-900/80 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Company</th>
                      <th className="px-4 py-3">Expires</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
                    {pendingInvites.map((r) => (
                      <tr key={r.invite_id}>
                        <td className="px-4 py-3 text-white">{r.email}</td>
                        <td className="px-4 py-3 text-zinc-400">{r.role}</td>
                        <td className="px-4 py-3 text-zinc-400">{r.company_name || r.company_id}</td>
                        <td className="px-4 py-3 text-xs text-zinc-500">{r.expires_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
