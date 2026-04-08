"use client";

import { Activity, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";
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
import { useTheme } from "@/components/theme/ThemeProvider";

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme();
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
      <div className="relative flex min-h-0 flex-1 flex-col justify-center py-10 md:py-14">
        <div className="relative mx-auto flex w-full max-w-[400px] flex-col">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[min(520px,88vh)] w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[2.75rem] bg-blue-500/[0.14] blur-3xl dark:bg-sky-500/[0.12]"
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.72] shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-lg dark:bg-white/[0.08] dark:shadow-[0_8px_36px_rgba(0,0,0,0.45)]">
            <div
              className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/[0.12] to-transparent dark:from-white/10"
              aria-hidden
            />
            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex flex-col items-center">
              <Link
                href={pulseRoutes.pulseLanding}
                className="flex items-center gap-2.5 font-headline text-lg font-bold tracking-tight text-pulse-navy no-underline hover:text-pulse-accent sm:text-xl dark:text-white dark:hover:text-sky-200"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200/80 bg-slate-50 text-pulse-accent shadow-sm dark:border-slate-600 dark:bg-slate-800/90 dark:text-sky-400">
                  <Activity className="h-4 w-4" strokeWidth={2} aria-hidden />
                </span>
                <span>Pulse</span>
              </Link>
              <p className="mt-4 text-center text-sm text-pulse-muted dark:text-slate-300">
                Sign in to your operational dashboard
              </p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
                {formError ? (
                  <p
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-sm font-medium text-red-800 dark:border-red-500/30 dark:bg-red-950/35 dark:text-red-200"
                    role="alert"
                  >
                    {formError}
                  </p>
                ) : null}

                <div>
                  <label
                    htmlFor={emailFieldId}
                    className="block text-sm font-semibold text-pulse-navy dark:text-slate-100"
                  >
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
                    className={`mt-1.5 w-full rounded-lg border bg-slate-50/80 px-3 py-2.5 text-sm text-pulse-navy outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-blue-500/40 focus:bg-white focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-white/20 dark:bg-white/10 dark:text-white dark:placeholder:text-slate-400 dark:focus:border-blue-500/40 dark:focus:bg-white/[0.12] dark:focus:ring-blue-500/30 ${
                      fieldErrors.identifier ? "border-red-400 dark:border-red-400/70" : "border-pulse-border dark:border-white/20"
                    }`}
                  />
                  {fieldErrors.identifier ? (
                    <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{fieldErrors.identifier}</p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor={passwordFieldId}
                    className="block text-sm font-semibold text-pulse-navy dark:text-slate-100"
                  >
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
                      className={`w-full rounded-lg border bg-slate-50/80 py-2.5 pl-3 pr-11 text-sm text-pulse-navy outline-none transition-all duration-200 focus:border-blue-500/40 focus:bg-white focus:ring-2 focus:ring-blue-500/30 disabled:opacity-60 dark:border-white/20 dark:bg-white/10 dark:text-white dark:focus:border-blue-500/40 dark:focus:bg-white/[0.12] dark:focus:ring-blue-500/30 ${
                        fieldErrors.password ? "border-red-400 dark:border-red-400/70" : "border-pulse-border dark:border-white/20"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-pulse-muted transition-colors hover:bg-slate-100 hover:text-pulse-navy dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      disabled={submitting}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <p className="mt-1 text-xs font-medium text-red-700 dark:text-red-300">{fieldErrors.password}</p>
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
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-indigo-600 py-3 text-sm font-semibold text-white shadow-[0_8px_28px_rgba(37,99,235,0.42)] outline-none transition-all duration-300 ease-out hover:brightness-[1.08] hover:shadow-[0_12px_36px_rgba(67,56,202,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-md disabled:hover:brightness-100"
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

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-pulse-border bg-slate-50/80 text-pulse-navy shadow-sm outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-blue-500/35 dark:border-white/20 dark:bg-white/10 dark:text-amber-200 dark:hover:bg-white/[0.15] dark:focus-visible:ring-blue-400/35"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-5 w-5" strokeWidth={2} aria-hidden />
                    ) : (
                      <Moon className="h-5 w-5" strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </div>
              </form>

              <div className="mt-8 border-t border-pulse-border pt-6 dark:border-white/10">
                <p className="text-center text-xs text-pulse-muted dark:text-slate-400">Need help?</p>
                <p className="mt-1 text-center text-xs text-pulse-muted dark:text-slate-400">
                  <Link
                    href={helixMarketingHref("/#contact")}
                    className="font-medium text-pulse-accent hover:underline"
                  >
                    Contact support
                  </Link>
                </p>
              </div>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-pulse-muted dark:text-slate-400">© 2026 Helix Systems</p>
        </div>
      </div>
    </>
  );
}
