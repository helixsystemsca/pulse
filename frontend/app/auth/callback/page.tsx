"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { completeMicrosoftSignInFromCallback } from "@/lib/microsoft-auth";
import { pulseApp } from "@/lib/pulse-app";

function callbackErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const raw =
    search.get("error_description") ||
    search.get("error") ||
    hash.get("error_description") ||
    hash.get("error");
  if (!raw) return null;
  if (raw.toLowerCase().includes("cancel")) return "Microsoft sign-in was cancelled.";
  return "Microsoft sign-in failed. Try again.";
}

export default function MicrosoftAuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);
  const loginHref = useMemo(() => pulseApp.login(), []);

  useEffect(() => {
    const providerError = callbackErrorFromUrl();
    if (providerError) {
      setError(providerError);
      return;
    }

    let cancelled = false;
    void completeMicrosoftSignInFromCallback().then((result) => {
      if (cancelled) return;
      if (!result.ok) setError(result.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthScreenShell className="login-web-canvas relative flex min-h-screen flex-col">
      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-[1.1rem] border border-white/80 bg-white px-5 py-6 text-center shadow-[0_20px_50px_rgba(76,96,133,0.12)] dark:border-ds-border dark:bg-ds-surface-primary dark:shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
          {error ? (
            <>
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-ds-danger dark:bg-rose-950/50">
                <AlertCircle className="h-5 w-5" aria-hidden />
              </div>
              <h1 className="mt-4 text-lg font-extrabold text-[#2f3d52] dark:text-ds-foreground">
                Microsoft sign-in could not continue
              </h1>
              <p className="mt-2 text-sm font-medium text-[#5a6d82] dark:text-ds-muted">{error}</p>
              <Link
                href={loginHref}
                className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#4c6085] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#3f5274] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6085] dark:bg-[#556b8e] dark:hover:bg-[#4c6085]"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#4c6085] dark:text-ds-muted" aria-hidden />
              <h1 className="mt-4 text-lg font-extrabold text-[#2f3d52] dark:text-ds-foreground">
                Completing Microsoft sign-in
              </h1>
              <p className="mt-2 text-sm font-medium text-[#5a6d82] dark:text-ds-muted">
                Hold on while we create your application session.
              </p>
            </>
          )}
        </div>
      </main>
    </AuthScreenShell>
  );
}
