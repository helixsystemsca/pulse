import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { ensureApiConfiguredFromEnv } from "@/lib/api/client";
import { loadSessionUser, loginWithPassword, type SessionUser } from "@/lib/api/auth";

const TOKEN_KEY = "pulse_access_token";

export type Session = {
  token: string;
  user: SessionUser;
};

type SessionCtx = {
  session: Session | null;
  /** False until SecureStore + optional `/auth/me` hydrate finishes. */
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetch `/auth/me` and update in-memory user (e.g. after profile photo upload). */
  refreshProfile: () => Promise<void>;
  has: (perm: string) => boolean;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      ensureApiConfiguredFromEnv();
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!token || cancelled) {
          if (!cancelled) setAuthReady(true);
          return;
        }
        const user = await loadSessionUser(token);
        if (!cancelled) setSession({ token, user });
      } catch {
        try {
          await SecureStore.deleteItemAsync(TOKEN_KEY);
        } catch {
          /* ignore */
        }
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    ensureApiConfiguredFromEnv();
    // Drop the previous principal immediately so UI (name, avatar) cannot flash the last user during swap.
    setSession(null);
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    const token = await loginWithPassword(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    const user = await loadSessionUser(token);
    setSession({ token, user });
  }, []);

  const signOut = useCallback(async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    } catch {
      /* ignore */
    }
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    ensureApiConfiguredFromEnv();
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    const user = await loadSessionUser(token);
    setSession({ token, user });
  }, []);

  const value = useMemo<SessionCtx>(() => {
    const perms = new Set(session?.user.permissions ?? []);
    return {
      session,
      authReady,
      signIn,
      signOut,
      refreshProfile,
      has: (perm: string) => {
        if (perms.has("*")) return true;
        return perms.has(perm);
      },
    };
  }, [session, authReady, signIn, signOut, refreshProfile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("SessionProvider missing");
  return v;
}
