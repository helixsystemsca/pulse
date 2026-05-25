"use client";

import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import Image from "next/image";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { AuthScreenShell } from "@/components/auth/AuthScreenShell";
import { LoginComingSoonFeaturesCard } from "@/components/auth/LoginComingSoonFeaturesCard";
import { AuroraBackground } from "@/components/ui/AuroraBackground";
import { LoginTessellationBackground } from "@/components/ui/LoginTessellationBackground";
import { isApiMode } from "@/lib/api";
import {
  attemptMockLogin,
  expandLoginEmail,
  isEmailShape,
  isLoggedIn,
  isPulseAuthTeardown,
  loginWithBackend,
  readSession,
  validateIdentifier,
  writeApiSession,
  writeSession,
} from "@/lib/pulse-session";
import { navigateAfterPulseLogin } from "@/lib/pulse-app";
import { PULSE_BUILD_VERSION } from "@/lib/pulse-build-version";
import { mailtoInfo, mailtoSupport } from "@/lib/helix-emails";
import { isMicrosoftSsoConfigured, startMicrosoftSignIn } from "@/lib/microsoft-auth";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/styles/button-variants";

function MicrosoftLogo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f25022" d="M1 1h10v10H1z" />
      <path fill="#7fba00" d="M12 1h10v10H12z" />
      <path fill="#00a4ef" d="M1 12h10v10H1z" />
      <path fill="#ffb900" d="M12 12h10v10H12z" />
    </svg>
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
  const [microsoftSubmitting, setMicrosoftSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const microsoftConfigured = isMicrosoftSsoConfigured();

  useEffect(() => {
    setHydrated(true);
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError) {
      setFormError(authError);
    }
    if (isPulseAuthTeardown()) return;
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
        writeApiSession(result.token, result.user, false, {
          allowDuringTeardown: true,
          resetWelcomeOverlay: true,
        });
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

      writeSession(identifier.trim(), false, { allowDuringTeardown: true });
      navigateAfterPulseLogin(readSession()!);
    } finally {
      setSubmitting(false);
    }
  }

  async function onMicrosoftSignIn() {
    setFormError(null);
    setFieldErrors({});
    setMicrosoftSubmitting(true);
    try {
      const result = await startMicrosoftSignIn();
      if (!result.ok) {
        setFormError(result.message);
      }
    } finally {
      setMicrosoftSubmitting(false);
    }
  }

  const labelClass =
    "mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--ds-text-primary)_72%,transparent)] dark:text-ds-muted";
  const inputShell =
    "relative flex w-full items-center gap-2 rounded-xl border border-[color-mix(in_srgb,#4c6085_12%,transparent)] bg-[color-mix(in_srgb,#cfe8ff_38%,#ffffff)] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] dark:border-ds-border dark:bg-ds-primary/80 dark:shadow-none";
  const inputInner =
    "min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-medium text-[color-mix(in_srgb,var(--ds-text-primary)_92%,transparent)] outline-none ring-0 placeholder:text-[color-mix(in_srgb,var(--ds-text-primary)_45%,transparent)] dark:text-ds-foreground dark:placeholder:text-ds-muted";

  return (
    <AuthScreenShell className="login-web-canvas login-web-canvas--aurora login-web-canvas--tessellation relative flex min-h-0 flex-1 flex-col">
      <AuroraBackground />
      <LoginTessellationBackground />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
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
          <LoginComingSoonFeaturesCard />
          <div className="login-content">
            <div className="login-content__form">
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

            <p className="mt-3 text-center text-sm font-medium text-[#5a6d82] dark:text-ds-muted sm:mt-3.5">
              Access only for verified users.
            </p>

            <div className="mt-3 rounded-[1.15rem] bg-[linear-gradient(145deg,rgba(255,255,255,0.55)_0%,rgba(255,255,255,0.18)_45%,rgba(186,230,255,0.22)_100%)] p-px shadow-[0_28px_64px_rgba(46,90,120,0.16)] ring-1 ring-white/50 backdrop-blur-md dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.05)_100%)] dark:ring-white/15 dark:shadow-[0_24px_52px_rgba(0,0,0,0.4)] sm:mt-4">
              <div className="relative overflow-hidden rounded-[1.1rem] border border-white/45 bg-white/[0.62] px-4 py-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(255,255,255,0.15),0_8px_32px_rgba(255,255,255,0.12)] backdrop-blur-[28px] backdrop-saturate-[1.35] dark:border-white/18 dark:bg-[color-mix(in_srgb,var(--ds-surface-primary)_58%,transparent)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] sm:px-5 sm:py-5">
                <div
                  className="pointer-events-none absolute inset-0 bg-[linear-gradient(128deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.08)_38%,transparent_55%,rgba(200,235,255,0.12)_100%)]"
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.65),transparent_70%)] blur-2xl"
                  aria-hidden
                />
                <form className="relative space-y-3.5" onSubmit={onSubmit} noValidate>
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
                        disabled={submitting || microsoftSubmitting}
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
                        disabled={submitting || microsoftSubmitting}
                        aria-invalid={Boolean(fieldErrors.password)}
                        className={`${inputInner} pr-1 ${fieldErrors.password ? "text-ds-danger" : ""}`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#4c6085]/70 transition-colors hover:bg-[color-mix(in_srgb,#4c6085_12%,transparent)] hover:text-[#3f5274] dark:text-ds-muted dark:hover:bg-ds-interactive-hover dark:hover:text-ds-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        disabled={submitting || microsoftSubmitting}
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
                    disabled={submitting || microsoftSubmitting}
                    className={cn(
                      buttonVariants({ surface: "light", intent: "accent" }),
                      "w-full gap-2 py-2.5 text-sm font-semibold tracking-normal disabled:opacity-60",
                    )}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        Signing in…
                      </>
                    ) : (
                      "Log in"
                    )}
                  </button>
                </form>

                <div className="my-4 flex items-center gap-3" aria-hidden="true">
                  <div className="h-px flex-1 bg-[color-mix(in_srgb,#4c6085_14%,transparent)] dark:bg-ds-border" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color-mix(in_srgb,var(--ds-text-primary)_38%,transparent)] dark:text-ds-muted">
                    OR
                  </span>
                  <div className="h-px flex-1 bg-[color-mix(in_srgb,#4c6085_14%,transparent)] dark:bg-ds-border" />
                </div>

                <button
                  type="button"
                  onClick={() => void onMicrosoftSignIn()}
                  disabled={submitting || microsoftSubmitting || !microsoftConfigured}
                  title={microsoftConfigured ? "Sign in with Microsoft" : "Microsoft sign-in is not configured"}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-[color-mix(in_srgb,#4c6085_18%,transparent)] bg-white px-4 py-2.5 text-sm font-extrabold text-[#2f3d52] shadow-sm transition-colors hover:border-[color-mix(in_srgb,#4c6085_30%,transparent)] hover:bg-[color-mix(in_srgb,#cfe8ff_36%,#ffffff)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4c6085] disabled:cursor-not-allowed disabled:opacity-60 dark:border-ds-border dark:bg-ds-secondary dark:text-ds-foreground dark:hover:bg-ds-interactive-hover"
                >
                  {microsoftSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <MicrosoftLogo className="h-4 w-4 shrink-0" />
                  )}
                  Sign in with Microsoft
                </button>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-0.5 text-[11px] font-semibold uppercase tracking-wide">
                  <a
                    href={mailtoInfo("Pulse — credentials help")}
                    className="text-ds-accent no-underline hover:underline"
                  >
                    Forgot credentials?
                  </a>
                  <span className="tabular-nums text-[color-mix(in_srgb,var(--ds-text-primary)_45%,transparent)] dark:text-ds-muted">
                    Terminal {PULSE_BUILD_VERSION}
                  </span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </main>
      </div>
    </AuthScreenShell>
  );
}
