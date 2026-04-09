"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { AuthBrandLink } from "@/components/auth/AuthBrandLink";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { getApiBaseUrl } from "@/lib/api";
import { navigateAfterPulseLogin, pulseApp } from "@/lib/pulse-app";
import { writeApiSession } from "@/lib/pulse-session";
import type { UserOut } from "@/lib/pulse-session";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";

function JoinForm() {
  const search = useSearchParams();
  const token = search.get("token") || "";
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const base = getApiBaseUrl();
      if (!base) throw new Error("API URL not configured");
      const res = await fetch(`${base}/api/v1/auth/employee-invite-accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, full_name: fullName || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.detail === "string" ? data.detail : "Invite could not be completed.");
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
    return <p className="text-center text-sm font-medium text-ds-danger">Missing token in URL.</p>;
  }

  return (
    <div className="auth-card-host ds-card-elevated mx-auto w-full max-w-[480px] rounded-2xl border border-ds-border p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <AuthBrandLink />
        <p className="mt-4 text-sm text-ds-muted">Employee invite</p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-ds-foreground">Activate your account</h1>
          <p className="mt-1 text-sm text-ds-muted">Set your password to finish joining your organization.</p>
        </div>
        {err ? (
          <div className="ds-notification ds-notification-critical flex gap-2 px-3 py-2 text-sm text-ds-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
            <p>{err}</p>
          </div>
        ) : null}
        <div>
          <label className={dsLabelClass} htmlFor="join-full-name">
            Full name (optional)
          </label>
          <input id="join-full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={`mt-1.5 ${dsInputClass}`} />
        </div>
        <div>
          <label className={dsLabelClass} htmlFor="join-password">
            Password (min 8 characters)
          </label>
          <input
            id="join-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1.5 ${dsInputClass}`}
          />
        </div>
        <button type="submit" disabled={busy} className="ds-btn-solid-primary w-full py-3 text-sm disabled:opacity-60">
          {busy ? "Working…" : "Activate account"}
        </button>
        <p className="text-center text-xs text-ds-muted">
          <a href={pulseApp.login()} className="ds-link">
            Sign in instead
          </a>
        </p>
      </form>
    </div>
  );
}

export default function JoinPage() {
  return (
    <AuthScreenShell className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-10 md:py-14">
        <Suspense fallback={<p className="text-center text-sm text-ds-muted">Loading…</p>}>
          <JoinForm />
        </Suspense>
      </div>
    </AuthScreenShell>
  );
}
