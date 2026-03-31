"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { apiFetch, getApiBaseUrl, refreshSessionWithToken } from "@/lib/api";
import { pulseRoutes } from "@/lib/pulse-app";
import { clearSession, readSession, type UserOut } from "@/lib/pulse-session";

export function SystemAppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<UserOut | null>(null);

  const loadMe = useCallback(async () => {
    const s = readSession();
    if (!s?.access_token) {
      router.replace(pulseRoutes.login);
      return;
    }
    try {
      const u = await apiFetch<UserOut>("/api/v1/auth/me");
      if (!u.is_system_admin) {
        clearSession();
        router.replace(pulseRoutes.login);
        return;
      }
      setMe(u);
      setReady(true);
    } catch {
      clearSession();
      router.replace(pulseRoutes.login);
    }
  }, [router]);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const exitImpersonation = async () => {
    const s = readSession();
    if (!s?.access_token) return;
    const base = getApiBaseUrl();
    const res = await fetch(`${base}/api/v1/auth/impersonation/exit`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s.access_token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { access_token: string };
    await refreshSessionWithToken(data.access_token, s.remember);
    await loadMe();
  };

  if (!ready || !me) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-400">Checking access…</div>
    );
  }

  return (
    <div className="min-h-full">
      {me.is_impersonating ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-700/50 bg-amber-950 px-4 py-2 text-sm text-amber-100">
          <span>
            You are impersonating <strong className="font-semibold">{me.full_name || me.email}</strong> ({me.email}
            ).
          </span>
          <button
            type="button"
            onClick={() => void exitImpersonation()}
            className="rounded-md bg-amber-800 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Exit impersonation
          </button>
        </div>
      ) : null}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
