"use client";

import { AlertCircle, Eye, EyeOff, Loader2, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import { AuthBrandLink } from "@/components/auth/AuthBrandLink";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
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

  const inputBase =
    "mt-1.5 w-full rounded-lg border bg-ds-primary px-3 py-2.5 text-sm text-ds-foreground shadow-sm outline-none transition-[border-color,box-shadow,background-color] duration-200 placeholder:text-ds-muted focus:border-[color-mix(in_srgb,var(--ds-success)_38%,var(--ds-border))] focus:ring-2 focus:ring-[var(--ds-focus-ring)] disabled:opacity-60";

  return (
    <AuthScreenShell className="flex flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col justify-center py-10 md:py-14">
        <div className="relative mx-auto flex w-full max-w-[480px] flex-col px-4 sm:px-0">
          <div className="auth-card-host ds-card-elevated w-full rounded-2xl border border-ds-border p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <AuthBrandLink />
              <p className="mt-4 text-sm text-ds-muted">Sign in to your operational dashboard</p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={onSubmit} noValidate>
              {formError ? (
                <div
                  className="ds-notification ds-notification-critical flex items-start justify-center gap-2 px-3 py-2 text-sm font-medium text-ds-foreground"
                  role="alert"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
                  <span className="text-center">{formError}</span>
                </div>
              ) : null}

              <div>
                <label htmlFor={emailFieldId} className="block text-sm font-semibold text-ds-foreground">
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
                  className={`${inputBase} ${
                    fieldErrors.identifier ? "border-ds-danger ring-1 ring-ds-danger/35" : "border-ds-border"
                  }`}
                />
                {fieldErrors.identifier ? (
                  <p className="mt-1 text-xs font-medium text-ds-danger">{fieldErrors.identifier}</p>
                ) : null}
              </div>

              <div>
                <label htmlFor={passwordFieldId} className="block text-sm font-semibold text-ds-foreground">
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
                    className={`w-full rounded-lg border bg-ds-primary py-2.5 pl-3 pr-11 text-sm text-ds-foreground shadow-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-[color-mix(in_srgb,var(--ds-success)_38%,var(--ds-border))] focus:ring-2 focus:ring-[var(--ds-focus-ring)] disabled:opacity-60 ${
                      fieldErrors.password ? "border-ds-danger ring-1 ring-ds-danger/35" : "border-ds-border"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ds-muted transition-colors duration-150 hover:bg-ds-interactive-hover hover:text-ds-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    disabled={submitting}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <p className="mt-1 text-xs font-medium text-ds-danger">{fieldErrors.password}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <a href={mailtoInfo("Pulse — password help")} className="ds-link text-sm">
                  Forgot password?
                </a>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="ds-btn-gradient-primary flex w-full items-center justify-center gap-2 py-3 text-sm"
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
                  className="ds-btn-auth-icon"
                >
                  {theme === "dark" ? (
                    <Sun className="h-5 w-5" strokeWidth={2} aria-hidden />
                  ) : (
                    <Moon className="h-5 w-5" strokeWidth={2} aria-hidden />
                  )}
                </button>
              </div>
            </form>

            <div className="mt-8 border-t border-ds-border pt-6">
              <p className="text-center text-xs text-ds-muted">Need help?</p>
              <p className="mt-1 text-center text-xs text-ds-muted">
                <Link href={helixMarketingHref("/#contact")} className="ds-link">
                  Contact support
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-ds-muted">© 2026 Helix Systems</p>
        </div>
      </div>
    </AuthScreenShell>
  );
}
