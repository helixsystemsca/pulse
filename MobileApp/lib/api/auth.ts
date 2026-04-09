import { apiFetch } from "./client";

export type AuthSession = {
  accessToken: string;
  user: {
    id: string;
    fullName: string;
    role: string;
    permissions: string[];
  };
};

export async function signIn(email: string, password: string): Promise<AuthSession> {
  // Placeholder shape — align with your existing Pulse auth when ready.
  return apiFetch<AuthSession>("/api/mobile/auth/sign-in", { body: { email, password } });
}

export async function signOut(): Promise<void> {
  return apiFetch<void>("/api/mobile/auth/sign-out", { method: "POST" });
}

