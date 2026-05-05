"use client";

import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
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
import { navigateAfterPulseLogin } from "@/lib/pulse-app";
import { PULSE_BUILD_VERSION } from "@/lib/pulse-build-version";
import { mailtoInfo, mailtoSupport } from "@/lib/helix-emails";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

function LoginRipples() {
  const rings = [520, 640, 760, 880, 1000, 1120];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {rings.map((size, i) => (
        <div
          key={size}
          className="absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[color-mix(in_srgb,var(--ds-text-primary)_8%,transparent)] dark:border-white/10"
          style={{
            width: size,
            height: size,
            opacity: 0.22 - i * 0.025,
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPage() {
  const [hydrated, setHydrated] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);
  const logoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailFieldId = useId();
  const passwordFieldId = useId();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});

  useEffect(() => {
    setHydrated(true);
    if (!isLoggedIn()) return;
    const s = readSession();
    if (s) navigateAfterPulseLogin(s);
  }, []);

  useEffect(() => {
    return () => {
      if (logoTimer.current) clearTimeout(logoTimer.current);
    };
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

  const labelClass =
    "mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--ds-text-primary)_72%,transparent)] dark:text-ds-muted";
  const inputShell =
    "relative flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_srgb,#4c6085_12%,transparent)] bg-[color-mix(in_srgb,#cfe8ff_38%,#ffffff)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-ds-border dark:bg-ds-primary/80 dark:shadow-none";
  const inputInner =
    "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)] outline-none ring-0 placeholder:text-[color-mix(in_srgb,var(--ds-text-primary)_45%,transparent)] dark:text-ds-foreground dark:placeholder:text-ds-muted";

  return (
    <AuthScreenShell className="login-web-canvas relative flex min-h-0 flex-1 flex-col">
      <div className="auth-shell-inner relative flex min-h-0 flex-1 flex-col">
        <LoginRipples />

        <header className="relative z-10 flex w-full items-center justify-end gap-4 px-5 py-2.5 sm:px-8 sm:py-3 lg:px-12">
          <nav className="flex items-center gap-1 sm:gap-2" aria-label="Login header">
            {/* TEMP: dark/light toggle removed — restore theme button here when re-enabling */}
            <a
              href={mailtoSupport("Pulse — Support")}
              className="inline-flex rounded-full bg-[#4c6085] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm transition-colors hover:bg-[#3f5274] sm:px-4 sm:py-2.5 sm:text-xs dark:bg-[#556b8e] dark:hover:bg-[#4c6085]"
            >
              Support
            </a>
          </nav>
        </header>

        <main className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-4 pb-4 pt-1 sm:px-6 sm:pb-5 md:px-8">
          <div className="mx-auto w-full max-w-[440px]">
            <div className="flex w-full justify-center">
              <div className="relative mx-auto h-[9.25rem] w-[min(22rem,calc(100vw-2rem))] shrink-0 sm:h-[11rem] sm:w-[min(26rem,calc(100vw-2rem))] md:h-[12.5rem] md:w-[min(30rem,calc(100vw-2.5rem))]">
                <Image
                  src="/images/panoramalogo2.png"
                  alt="Panorama"
                  fill
                  priority
                  sizes="(max-width: 640px) 90vw, (max-width: 768px) 26rem, 30rem"
                  className={cn(
                    "object-contain object-center transition-opacity duration-500 ease-out will-change-[opacity]",
                    hydrated && logoVisible ? "opacity-100" : "opacity-0",
                  )}
                  onLoadingComplete={() => {
                    if (logoVisible) return;
                    if (logoTimer.current) clearTimeout(logoTimer.current);
                    logoTimer.current = setTimeout(() => setLogoVisible(true), 140);
                  }}
                />
              </div>
            </div>

            <h1 className="mt-5 text-center font-headline text-[1.5rem] font-extrabold leading-tight tracking-tight text-[#2f3d52] dark:text-ds-foreground sm:mt-6 sm:text-[1.65rem] md:text-3xl">
              Enhance your daily operations.
            </h1>
            <p className="mt-1.5 text-center text-sm font-medium text-[#5a6d82] dark:text-ds-muted">
              Invite-only access for verified operators.
            </p>

            <div className="mt-5 rounded-[1.15rem] bg-[linear-gradient(180deg,rgba(207,231,255,0.85)_0%,rgba(230,236,245,0.55)_100%)] p-[1px] shadow-[0_20px_50px_rgba(76,96,133,0.12)] dark:bg-ds-border dark:p-px dark:shadow-[0_16px_40px_rgba(0,0,0,0.25)] sm:mt-6">
              <div className="rounded-[1.1rem] border border-white/80 bg-white px-4 py-4 dark:border-ds-border dark:bg-ds-surface-primary sm:px-5 sm:py-5">
                <form className="space-y-3.5" onSubmit={onSubmit} noValidate>
                  {formError ? (
                    <div
                      className="ds-notification ds-notification-critical flex items-start justify-center gap-2 px-2.5 py-1.5 text-sm font-medium text-ds-foreground"
                      role="alert"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-ds-danger" aria-hidden />
                      <span className="text-center">{formError}</span>
                    </div>
                  ) : null}

                  <div>
                    <label htmlFor={emailFieldId} className={labelClass}>
                      Work email
                    </label>
                    <div className={inputShell}>
                      <input
                        id={emailFieldId}
                        name="identifier"
                        type="text"
                        autoComplete="username"
                        placeholder="operator@company.com"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        disabled={submitting}
                        aria-invalid={Boolean(fieldErrors.identifier)}
                        className={`${inputInner} ${fieldErrors.identifier ? "text-ds-danger placeholder:text-ds-danger/70" : ""}`}
                      />
                      <Mail className="h-4 w-4 shrink-0 text-[#4c6085]/55 dark:text-ds-muted" aria-hidden />
                    </div>
                    {fieldErrors.identifier ? (
                      <p className="mt-1 text-xs font-medium text-ds-danger">{fieldErrors.identifier}</p>
                    ) : null}
                  </div>

                  <div>
                    <label htmlFor={passwordFieldId} className={labelClass}>
                      Password
                    </label>
                    <div className={inputShell}>
                      <input
                        id={passwordFieldId}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={submitting}
                        aria-invalid={Boolean(fieldErrors.password)}
                        className={`${inputInner} pr-1 ${fieldErrors.password ? "text-ds-danger" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#4c6085]/70 transition-colors hover:bg-[color-mix(in_srgb,#4c6085_12%,transparent)] hover:text-[#3f5274] dark:text-ds-muted dark:hover:bg-ds-interactive-hover dark:hover:text-ds-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={submitting}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <Lock className="h-4 w-4 shrink-0 text-[#4c6085]/55 dark:text-ds-muted" aria-hidden />
                    </div>
                    {fieldErrors.password ? (
                      <p className="mt-1 text-xs font-medium text-ds-danger">{fieldErrors.password}</p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(
                      buttonVariants({ surface: "light", intent: "accent" }),
                      "w-full gap-2 py-2.5 text-xs font-extrabold uppercase tracking-[0.18em] disabled:opacity-60",
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Authenticating…
                      </>
                    ) : (
                      "Authenticate"
                    )}
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] font-semibold uppercase tracking-wide">
                    <a
                      href={mailtoInfo("Pulse — credentials help")}
                      className="text-[color-mix(in_srgb,var(--ds-success)_78%,#1a4d44)] no-underline hover:underline dark:text-ds-success"
                    >
                      Forgot credentials?
                    </a>
                    <span className="tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_45%,transparent)] dark:text-ds-muted">
                      Terminal {PULSE_BUILD_VERSION}
                    </span>
                  </div>
                </form>
              </div>
            </div>

            <div className="relative mt-5 sm:mt-6">
              <div className="h-px w-full bg-[color-mix(in_srgb,#4c6085_14%,transparent)] dark:bg-ds-border" />
              <p className="absolute left-1/2 top-1/2 w-max -translate-x-1/2 -translate-y-1/2 bg-[#fafbfd] px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ds-text-primary)_38%,transparent)] dark:bg-[var(--ds-bg)] dark:text-ds-muted">
                Secure link
              </p>
            </div>
          </div>
        </main>

        <footer className="relative z-10 mt-auto border-t border-[color-mix(in_srgb,#4c6085_10%,transparent)] bg-[color-mix(in_srgb,#ffffff_70%,transparent)] px-5 py-2 dark:border-ds-border dark:bg-ds-surface-primary/40 sm:px-8 sm:py-2.5 lg:px-12">
          <p className="mx-auto max-w-6xl text-center text-[10px] font-bold uppercase tracking-wide text-[color-mix(in_srgb,var(--ds-text-primary)_48%,transparent)] dark:text-ds-muted">
            © {new Date().getFullYear()} Helix Systems
          </p>
        </footer>
      </div>
    </AuthScreenShell>
  );
}
