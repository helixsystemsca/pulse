"use client";

import { useSearchParams } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { AuthBrandLink } from "@/components/auth/AuthBrandLink";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { dsInputClass, dsLabelClass } from "@/components/ui/ds-form-classes";
import { getApiBaseUrl } from "@/lib/api";
import { parseApiResponseJson } from "@/lib/parse-api-json-response";
import { navigateAfterPulseLogin, pulseApp } from "@/lib/pulse-app";
import { writeApiSession } from "@/lib/pulse-session";
import type { UserOut } from "@/lib/pulse-session";
import { applyServerTimeFromUserOut } from "@/lib/serverTime";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

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
      const meUrl = `${base}/api/v1/auth/me`;
      const meRes = await fetch(meUrl, {
        headers: { Authorization: `Bearer ${access_token}` },
      });
      const meText = await meRes.text();
      if (!meRes.ok) {
        setErr("Could not load your profile after reset.");
        return;
      }
      const user = parseApiResponseJson(meText, { ok: true, status: meRes.status, url: meUrl }) as UserOut;
      applyServerTimeFromUserOut(user);
      writeApiSession(access_token, user, false);
      navigateAfterPulseLogin(user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
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
        <p className="mt-4 text-sm text-ds-muted">Secure password reset</p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        <div>
          <h1 className="text-lg font-semibold text-ds-foreground">Reset password</h1>
          <p className="mt-1 text-sm text-ds-muted">Choose a new password for your account.</p>
        </div>
        {err ? (
          <div className="ds-notification ds-notification-critical flex gap-2 px-3 py-2 text-sm text-ds-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
            <p>{err}</p>
          </div>
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
        <button type="submit" disabled={busy} className={cn(buttonVariants({ surface: "light", intent: "accent" }), "w-full py-3 text-sm")}>
          {busy ? "Updating…" : "Save and sign in"}
        </button>
        <p className="text-center text-xs text-ds-muted">
          <a href={pulseApp.login()} className="ds-link">
            Back to login
          </a>
        </p>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthScreenShell className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-center px-4 py-10 md:py-14">
        <Suspense fallback={<p className="text-center text-sm text-ds-muted">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </AuthScreenShell>
  );
}
