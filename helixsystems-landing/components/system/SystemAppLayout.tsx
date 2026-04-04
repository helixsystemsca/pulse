"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getApiBaseUrl, refreshSessionWithToken } from "@/lib/api";
import { navigateToPulseLogin, pulsePostLoginPath } from "@/lib/pulse-app";
import { clearSession, readSession, type UserOut } from "@/lib/pulse-session";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";

export function SystemAppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<UserOut | null>(null);

  const bounceTenantToOverview = useCallback(() => {
    router.replace("/overview");
  }, [router]);

  const loadMe = useCallback(async () => {
    const s = readSession();
    if (!s?.access_token) {
      navigateToPulseLogin();
      return;
    }
    if (pulsePostLoginPath(s) !== "/system") {
      bounceTenantToOverview();
      return;
    }
    try {
      const u = await apiFetch<UserOut>("/api/v1/auth/me");
      applyServerTimeFromUserOut(u);
      if (pulsePostLoginPath(u) !== "/system") {
        bounceTenantToOverview();
        return;
      }
      setMe(u);
      setReady(true);
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : undefined;
      if (status === 401) {
        clearSession();
        navigateToPulseLogin();
        return;
      }
      bounceTenantToOverview();
    }
  }, [bounceTenantToOverview]);

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
      <div className="min-w-0">{children}</div>
    </div>
  );
}
