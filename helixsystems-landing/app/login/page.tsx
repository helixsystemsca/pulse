"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useState } from "react";
import { isApiMode } from "@/lib/api";
import {
  attemptMockLogin,
  expandLoginEmail,
  isEmailShape,
  isLoggedIn,
  loginWithBackend,
  validateIdentifier,
  writeApiSession,
  writeSession,
} from "@/lib/pulse-session";
import { pulseRoutes } from "@/lib/pulse-app";

export default function LoginPage() {
  const router = useRouter();
  const emailFieldId = useId();
  const passwordFieldId = useId();
  const rememberId = useId();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  useEffect(() => {
    if (isLoggedIn()) {
      router.replace(pulseRoutes.overview);
    }
  }, [router]);

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
        writeApiSession(result.token, result.user, remember);
        router.push(pulseRoutes.overview);
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

      writeSession(identifier.trim(), remember);
      router.push(pulseRoutes.overview);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-200/90 px-4 py-12 md:py-16">
      <div className="mx-auto flex w-full max-w-[400px] flex-col">
        <div className="rounded-2xl border border-pulse-border bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-center font-headline text-2xl font-bold tracking-tight text-pulse-navy">
            Welcome to Pulse
          </h1>
          <p className="mt-2 text-center text-sm text-pulse-muted">Sign in to your operational dashboard</p>

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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-pulse-navy">
                <input
                  id={rememberId}
                  name="remember"
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={submitting}
                  className="h-4 w-4 rounded border-pulse-border text-pulse-accent focus:ring-pulse-accent"
                />
                <span>Keep me signed in</span>
              </label>
              <Link
                href="/#contact"
                className="text-sm font-semibold text-pulse-accent underline-offset-2 transition-colors hover:text-pulse-accent-hover hover:underline"
              >
                Forgot password?
              </Link>
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
              <Link href="/#contact" className="font-medium text-pulse-accent hover:underline">
                Contact support
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-pulse-muted">© 2026 Helix Systems</p>
      </div>
    </div>
  );
}
