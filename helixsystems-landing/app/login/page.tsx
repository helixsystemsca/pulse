"use client";

import { Activity, Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { isApiMode } from "@/lib/api";
import {
  attemptMockLogin,
  expandLoginEmail,
  isEmailShape,
  isLoggedIn,
  loginWithBackend,
  readSession,
  validateIdentifier,
  writeApiSession,
  writeSession,
} from "@/lib/pulse-session";
import { helixMarketingHref, navigateAfterPulseLogin, pulseRoutes } from "@/lib/pulse-app";
import { mailtoInfo } from "@/lib/helix-emails";

export default function LoginPage() {
  const emailFieldId = useId();
  const passwordFieldId = useId();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  useEffect(() => {
    if (!isLoggedIn()) return;
    const s = readSession();
    if (s) navigateAfterPulseLogin(s);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const nextField: typeof fieldErrors = {};
    if (!identifier.trim()) {
      nextField.identifier = "Enter your email or username.";
    } else if (!validateIdentifier(identifier)) {
      nextField.identifier = "Enter a valid email or a username (3+ characters).";
    }
    if (!password) {
      nextField.password = "Enter your password.";
    }

    if (Object.keys(nextField).length > 0) {
      setFieldErrors(nextField);
      setFormError("Please fix the fields below.");
      return;
    }

    setSubmitting(true);
    try {
      if (isApiMode()) {
        const loginEmail = expandLoginEmail(identifier);
        if (!isEmailShape(loginEmail)) {
          setFieldErrors({
            identifier:
              "Use an email address, or set NEXT_PUBLIC_PULSE_LOGIN_EMAIL_DOMAIN so a short username works.",
          });
          setFormError("Please fix the fields below.");
          return;
        }
        if (password.length < 8) {
          setFieldErrors({
            password: "Password must be at least 8 characters.",
          });
          setFormError("Please fix the fields below.");
          return;
        }
        const result = await loginWithBackend(loginEmail, password);
        if (!result.ok) {
          if (result.reason === "api_config") {
            setFormError("Server URL is not configured. Set NEXT_PUBLIC_API_URL or use demo mode.");
          } else {
            setFormError("Invalid credentials. Check your email and password.");
          }
          return;
        }
        writeApiSession(result.token, result.user, false);
        navigateAfterPulseLogin(result.user);
        return;
      }

      const result = await attemptMockLogin(identifier, password);
      if (!result.ok) {
        if (result.reason === "missing_fields") {
          setFormError("Please fill in all fields.");
        } else if (result.reason === "validation") {
          setFieldErrors({ identifier: "Check your email or username format." });
          setFormError("Please fix the fields below.");
        } else {
          setFormError("Invalid credentials. Check your email and password.");
        }
        return;
      }

      writeSession(identifier.trim(), false);
      navigateAfterPulseLogin(readSession()!);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className="absolute inset-0 bg-gradient-to-br from-[#edf2fb] via-[#f5f2f9] to-[#e6eef9] dark:from-[#0f172a] dark:via-[#111827] dark:to-[#0b1220]"
        />
        <div
          className="absolute inset-0 dark:hidden"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='none' stroke='%2330568b' stroke-width='0.85' stroke-opacity='0.11'%3E%3Cpath d='M16 6v20M6 16h20'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: "32px 32px",
          }}
        />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Cg fill='none' stroke='%234a6fa5' stroke-width='0.85' stroke-opacity='0.14'%3E%3Cpath d='M16 6v20M6 16h20'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute -right-[18%] top-[-22%] h-[96%] w-[min(78vw,760px)] rounded-[48%] bg-gradient-to-b from-[#30568b]/[0.14] via-[#4a6fa5]/[0.08] to-transparent blur-3xl dark:from-[#4a6fa5]/[0.12] dark:via-[#30568b]/[0.06]" />
        <div className="absolute right-0 top-[12%] h-[68%] w-[min(52vw,520px)] rotate-[10deg] rounded-[42%] bg-gradient-to-l from-[#30568b]/10 via-transparent to-transparent opacity-80 blur-2xl dark:from-[#4a6fa5]/12" />
        <div className="absolute right-[8%] bottom-[-8%] h-[48%] w-[min(40vw,400px)] -rotate-[8deg] rounded-[50%] bg-gradient-to-tl from-[#4a6fa5]/8 to-transparent blur-3xl dark:from-[#30568b]/10" />
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center py-10 md:py-14">
        <div className="mx-auto flex w-full max-w-[400px] flex-col">
          <div className="rounded-[2rem] border border-[#c3c6d1]/35 bg-white/95 p-6 shadow-[0_25px_65px_-16px_rgba(48,86,139,0.14),0_10px_28px_-10px_rgba(15,23,42,0.08)] backdrop-blur-[2px] dark:border-[#374151] dark:bg-[#111827]/95 dark:shadow-[0_25px_65px_-16px_rgba(0,0,0,0.45)] sm:p-8">
            <div className="flex flex-col items-center">
              <Link
                href={pulseRoutes.pulseLanding}
                className="flex items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-pulse-navy no-underline hover:text-pulse-accent sm:text-xl"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-pulse-accent shadow-sm">
                  <Activity className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <span>Pulse</span>
              </Link>
              <p className="mt-4 text-center text-sm text-pulse-muted">Sign in to your operational dashboard</p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
              {formError ? (
                <p
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-800"
                  role="alert"
                >
                  {formError}
                </p>
              ) : null}

              <div>
                <label htmlFor={emailFieldId} className="block text-sm font-semibold text-pulse-navy">
                  Email or Username
                </label>
                <input
                  id={emailFieldId}
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  placeholder="name@company.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={submitting}
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  className={`mt-1.5 w-full rounded-lg border bg-slate-50/80 px-3 py-2.5 text-sm text-pulse-navy outline-none ring-pulse-accent/30 transition-all duration-200 placeholder:text-slate-400 focus:border-pulse-accent focus:bg-white focus:ring-2 disabled:opacity-60 ${
                    fieldErrors.identifier ? "border-red-400" : "border-pulse-border"
                  }`}
                />
                {fieldErrors.identifier ? (
                  <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.identifier}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor={passwordFieldId} className="block text-sm font-semibold text-pulse-navy">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <input
                    id={passwordFieldId}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting}
                    aria-invalid={Boolean(fieldErrors.password)}
                    className={`w-full rounded-lg border bg-slate-50/80 py-2.5 pl-3 pr-11 text-sm text-pulse-navy outline-none ring-pulse-accent/30 transition-all duration-200 focus:border-pulse-accent focus:bg-white focus:ring-2 disabled:opacity-60 ${
                      fieldErrors.password ? "border-red-400" : "border-pulse-border"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-pulse-muted transition-colors hover:bg-slate-100 hover:text-pulse-navy"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={submitting}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="mt-1 text-xs font-medium text-red-700">{fieldErrors.password}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <a
                  href={mailtoInfo("Pulse — password help")}
                  className="text-sm font-semibold text-pulse-accent underline-offset-2 transition-colors hover:text-pulse-accent-hover hover:underline"
                >
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-pulse-accent py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-pulse-accent-hover hover:shadow-lg hover:shadow-blue-600/25 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="mt-8 border-t border-pulse-border pt-6">
              <p className="text-center text-xs text-pulse-muted">Need help?</p>
              <p className="mt-1 text-center text-xs text-pulse-muted">
                <Link
                  href={helixMarketingHref("/#contact")}
                  className="font-medium text-pulse-accent hover:underline"
                >
                  Contact support
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-pulse-muted dark:text-slate-400">© 2026 Helix Systems</p>
        </div>
      </div>
    </>
  );
}
