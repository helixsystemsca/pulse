import React, { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Session = {
  token: string;
  user: { id: string; fullName: string; role: string; permissions: string[] };
};

type SessionCtx = {
  session: Session | null;
  setSession: (s: Session | null) => void;
  has: (perm: string) => boolean;
};

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);

  const value = useMemo<SessionCtx>(() => {
    const perms = new Set(session?.user.permissions ?? []);
    return {
      session,
      setSession,
      has: (perm: string) => perms.has(perm),
    };
  }, [session]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("SessionProvider missing");
  return v;
}

