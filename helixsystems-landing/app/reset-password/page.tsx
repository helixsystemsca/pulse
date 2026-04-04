"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { getApiBaseUrl } from "@/lib/api";
import { navigateAfterPulseLogin, pulseApp } from "@/lib/pulse-app";
import { writeApiSession } from "@/lib/pulse-session";
import type { UserOut } from "@/lib/pulse-session";

function ResetForm() {
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const base = getApiBaseUrl();
      if (!base) throw new Error("API URL not configured");
      const res = await fetch(`${base}/api/v1/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.detail === "string" ? data.detail : "Reset failed.");
        return;
      }
      const access_token = (data as { access_token: string }).access_token;
      const meRes = await fetch(`${base}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const user = (await meRes.json()) as UserOut;
      writeApiSession(access_token, user, false);
      navigateAfterPulseLogin(user);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <p className="text-red-400">Missing token in URL.</p>;
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mx-auto mt-16 max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-100">
      <h1 className="text-lg font-semibold">Reset password</h1>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <div>
        <label className="text-xs uppercase text-zinc-500">New password</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? "Updating…" : "Save and sign in"}
      </button>
      <p className="text-center text-xs text-zinc-500">
        <a href={pulseApp.login()} className="text-blue-400">
          Back to login
        </a>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-4">
      <Suspense fallback={<p className="p-8 text-zinc-500">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
