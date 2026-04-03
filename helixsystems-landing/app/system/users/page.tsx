"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All roles" },
  { value: "system_admin", label: "System admin" },
  { value: "company_admin", label: "Company admin" },
  { value: "manager", label: "Manager" },
  { value: "worker", label: "Worker" },
];

const INPUT =
  "w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";
const BTN_PRIMARY = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500";
const BTN_SECONDARY = "rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-800";

export default function SystemUsersPage() {
  const router = useRouter();
  const session = readSession();
  const myUserId = session?.sub ?? "";

  const [rows, setRows] = useState<UserRow[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInviteRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const [appliedQ, setAppliedQ] = useState("");
  const [appliedRole, setAppliedRole] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftQ, setDraftQ] = useState("");
  const [draftRole, setDraftRole] = useState("");

  const openFilters = () => {
    setDraftQ(appliedQ);
    setDraftRole(appliedRole);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setAppliedQ(draftQ);
    setAppliedRole(draftRole);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftQ("");
    setDraftRole("");
    setAppliedQ("");
    setAppliedRole("");
    setFilterOpen(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const sp = new URLSearchParams();
      sp.set("limit", "200");
      if (appliedQ.trim()) sp.set("q", appliedQ.trim());
      if (appliedRole.trim()) sp.set("role", appliedRole.trim());
      const data = await apiFetch<UsersDirectory>(`/api/system/users?${sp.toString()}`);
      setRows(data.users ?? []);
      setPendingInvites(data.pending_invites ?? []);
    } catch (e: unknown) {
      setRows([]);
      setPendingInvites([]);
      setLoadError(parseClientApiError(e).message);
    } finally {
      setLoading(false);
    }
  }, [appliedQ, appliedRole]);

  useEffect(() => {
    void load();
  }, [load]);

  const filterBadge = useMemo(() => {
    let n = 0;
    if (appliedQ.trim()) n += 1;
    if (appliedRole.trim()) n += 1;
    return n;
  }, [appliedQ, appliedRole]);

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

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`Permanently delete user ${email}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/system/users/${userId}`, { method: "DELETE" });
      await load();
    } catch (e: unknown) {
      setLoadError(parseClientApiError(e).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Users</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Tenant accounts and pending invites. Use impersonation to open Pulse as a company user.
          </p>
        </div>
        <button
          type="button"
          onClick={openFilters}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-800"
        >
          Filters
          {filterBadge > 0 ? (
            <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">{filterBadge}</span>
          ) : null}
        </button>
      </div>

      {filterOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setFilterOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-6 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-filter-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h2 id="users-filter-title" className="text-lg font-semibold text-white">
                Filter users
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                onClick={() => setFilterOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-medium text-zinc-400" htmlFor="users-q">
                  Search
                </label>
                <input
                  id="users-q"
                  value={draftQ}
                  onChange={(e) => setDraftQ(e.target.value)}
                  placeholder="Email, name, company…"
                  className={`mt-1 ${INPUT}`}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400" htmlFor="users-role">
                  Role
                </label>
                <select
                  id="users-role"
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value)}
                  className={`mt-1 ${INPUT}`}
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className={BTN_SECONDARY} onClick={() => void clearFilters()}>
                Clear
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={applyFilters}>
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-200">
          <p className="font-medium">{loadError}</p>
        </div>
      ) : null}

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
            <h2 className="text-sm font-semibold text-zinc-300">Directory</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Completed signups only. <strong className="text-zinc-400">Delete</strong> removes the account (not allowed for
              yourself or the last system admin).
            </p>
            {rows.length === 0 ? (
              <p className="mt-3 text-sm text-zinc-500">No users match these filters.</p>
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
                          {r.id !== myUserId ? (
                            <button
                              type="button"
                              onClick={() => void deleteUser(r.id, r.email)}
                              className="text-xs text-red-400 hover:underline"
                            >
                              Delete
                            </button>
                          ) : null}
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
              Open invites that have not finished signup—no account to impersonate yet.
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
