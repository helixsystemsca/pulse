"use client";

import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Card } from "@/components/pulse/Card";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { getApiBaseUrl } from "@/lib/api";
import { navigateAfterPulseLogin, pulseApp } from "@/lib/pulse-app";
import { writeApiSession } from "@/lib/pulse-session";
import type { UserOut } from "@/lib/pulse-session";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";

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
      applyServerTimeFromUserOut(user);
      writeApiSession(access_token, user, false);
      navigateAfterPulseLogin(user);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <p className="text-ds-danger">Missing token in URL.</p>;
  }

  return (
    <Card variant="elevated" padding="lg" className="mx-auto mt-16 max-w-md space-y-4">
      <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <h1 className="text-lg font-semibold text-ds-foreground">Reset password</h1>
        {err ? (
          <p className="ds-alert-critical rounded-lg border px-3 py-2 text-sm text-ds-foreground">{err}</p>
        ) : null}
        <div>
          <label className={dsLabelClass} htmlFor="reset-password">
            New password
          </label>
          <input
            id="reset-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1.5 ${dsInputClass}`}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="ds-btn-solid-primary w-full py-2.5 text-sm disabled:opacity-60"
        >
          {busy ? "Updating…" : "Save and sign in"}
        </button>
        <p className="text-center text-xs text-ds-muted">
          <a href={pulseApp.login()} className="ds-link">
            Back to login
          </a>
        </p>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-ds-bg px-4">
      <Suspense fallback={<p className="p-8 text-ds-muted">Loading…</p>}>
        <ResetForm />
      </Suspense>
    </div>
  );
}
