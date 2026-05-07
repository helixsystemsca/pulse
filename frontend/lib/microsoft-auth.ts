"use client";

import type { AuthError } from "@supabase/supabase-js";

import { getApiBaseUrl, refreshSessionWithToken } from "@/lib/api";
import { navigateAfterPulseLogin, pulseAppHref } from "@/lib/pulse-app";
import { isSupabaseBrowserConfigured, getSupabaseBrowserClient } from "@/lib/supabaseClient";
import type { PulseAuthSession } from "@/lib/pulse-session";

const MICROSOFT_OAUTH_RETURN_TO_KEY = "pulse_microsoft_oauth_return_to";

type TokenResponse = { access_token: string; token_type?: string };

export type MicrosoftAuthResult =
  | { ok: true; user: PulseAuthSession }
  | { ok: false; message: string };

export function isMicrosoftSsoConfigured(): boolean {
  return Boolean(getApiBaseUrl() && isSupabaseBrowserConfigured());
}

function isSafePulseReturnPath(value: string | null | undefined): value is string {
  if (!value) return false;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;
  if (value.startsWith("/login") || value.startsWith("/auth/callback")) return false;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function returnToFromLoginUrl(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  for (const key of ["next", "returnTo", "redirectTo"]) {
    const value = params.get(key);
    if (isSafePulseReturnPath(value)) return value;
  }
  return null;
}

function consumeStoredReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem(MICROSOFT_OAUTH_RETURN_TO_KEY);
    window.sessionStorage.removeItem(MICROSOFT_OAUTH_RETURN_TO_KEY);
    return isSafePulseReturnPath(stored) ? stored : null;
  } catch {
    return null;
  }
}

function storeReturnToForOAuth(): void {
  if (typeof window === "undefined") return;
  const returnTo = returnToFromLoginUrl();
  try {
    if (returnTo) {
      window.sessionStorage.setItem(MICROSOFT_OAUTH_RETURN_TO_KEY, returnTo);
    } else {
      window.sessionStorage.removeItem(MICROSOFT_OAUTH_RETURN_TO_KEY);
    }
  } catch {
    /* sessionStorage is optional; post-login role routing still works without it. */
  }
}

function callbackUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_OAUTH_REDIRECT_URL?.trim();
  if (configured) return configured;
  return `${window.location.origin}/auth/callback`;
}

function oauthErrorMessage(error: AuthError): string {
  const msg = error.message.trim();
  if (!msg) return "Microsoft sign-in failed. Try again.";
  if (msg.toLowerCase().includes("cancel")) {
    return "Microsoft sign-in was cancelled.";
  }
  return msg;
}

async function exchangeMicrosoftToken(accessToken: string): Promise<TokenResponse> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error("Server URL is not configured. Set NEXT_PUBLIC_API_URL before using Microsoft sign-in.");
  }
  const res = await fetch(`${base}/api/v1/auth/oauth/microsoft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as { detail?: unknown } & Partial<TokenResponse>) : {};
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : "Microsoft sign-in failed. Try again.";
    throw new Error(detail);
  }
  if (!data.access_token) {
    throw new Error("Microsoft sign-in did not return an application session.");
  }
  return { access_token: data.access_token, token_type: data.token_type };
}

export async function startMicrosoftSignIn(): Promise<{ ok: true } | { ok: false; message: string }> {
  if (typeof window === "undefined") {
    return { ok: false, message: "Microsoft sign-in is only available in the browser." };
  }
  if (!isMicrosoftSsoConfigured()) {
    return {
      ok: false,
      message: "Microsoft sign-in is not configured for this environment.",
    };
  }

  storeReturnToForOAuth();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo: callbackUrl(),
    },
  });
  if (error) {
    return { ok: false, message: oauthErrorMessage(error) };
  }
  return { ok: true };
}

export function signOutSupabaseIdentity(): void {
  if (!isSupabaseBrowserConfigured()) return;
  try {
    void getSupabaseBrowserClient().auth.signOut();
  } catch {
    /* Pulse logout must still complete if Supabase is unavailable or unconfigured. */
  }
}

export async function completeMicrosoftSignInFromCallback(): Promise<MicrosoftAuthResult> {
  if (!isMicrosoftSsoConfigured()) {
    return { ok: false, message: "Microsoft sign-in is not configured for this environment." };
  }

  const supabase = getSupabaseBrowserClient();
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return { ok: false, message: oauthErrorMessage(error) };
    }
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    return { ok: false, message: oauthErrorMessage(error) };
  }
  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return { ok: false, message: "Microsoft sign-in session was not found. Try signing in again." };
  }

  try {
    const token = await exchangeMicrosoftToken(accessToken);
    await refreshSessionWithToken(token.access_token, false);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Microsoft sign-in failed. Try again.",
    };
  }

  const { readSession } = await import("@/lib/pulse-session");
  const session = readSession();
  if (!session) {
    return { ok: false, message: "Application session could not be created. Try signing in again." };
  }

  const returnTo = consumeStoredReturnTo();
  if (returnTo) {
    window.location.assign(pulseAppHref(returnTo));
  } else {
    navigateAfterPulseLogin(session);
  }
  return { ok: true, user: session };
}
