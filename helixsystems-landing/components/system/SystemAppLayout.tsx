"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useCallback, useEffect, useState } from "react";
import { apiFetch, getApiBaseUrl, refreshSessionWithToken } from "@/lib/api";
import { pulseRoutes } from "@/lib/pulse-app";
import { clearSession, readSession, type UserOut } from "@/lib/pulse-session";

const nav = [
  { href: "/system", label: "Overview" },
  { href: "/system/companies", label: "Companies" },
  { href: "/system/users", label: "Users" },
  { href: "/system/logs", label: "System logs" },
];

export function SystemAppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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

  const signOut = () => {
    clearSession();
    router.push(pulseRoutes.login);
  };

  if (!ready || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400">
        Checking access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {me.is_impersonating ? (
        <div className="flex items-center justify-between border-b border-amber-700/50 bg-amber-950 px-4 py-2 text-sm text-amber-100">
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
      <div className="flex">
        <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-900/80">
          <div className="border-b border-zinc-800 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Pulse</p>
            <p className="text-sm font-semibold text-zinc-200">System admin</p>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-2">
            {nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    active ? "bg-blue-600/20 text-blue-300" : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-zinc-800 p-2">
            <p className="truncate px-2 text-xs text-zinc-500">{me.email}</p>
            <button
              type="button"
              onClick={signOut}
              className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Sign out
            </button>
          </div>
        </aside>
        <main className="min-h-screen flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
