"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const path = mode === "login" ? "/api/v1/auth/login" : "/api/v1/auth/register";
      const body =
        mode === "login"
          ? { email, password }
          : { email, password, role: "admin", full_name: "Demo Admin" };
      const res = await apiFetch<{ access_token: string }>(path, {
        method: "POST",
        json: body,
      });
      setToken(res.access_token);
      const me = await apiFetch<{ role: string }>("/api/v1/auth/me", {});
      if (me.role === "admin") router.push("/admin");
      else router.push("/worker");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", padding: "0 1rem" }}>
      <h1>{mode === "login" ? "Sign in" : "Create demo tenant"}</h1>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
        Register creates an admin user and enables all modules for that tenant.
      </p>
      <form onSubmit={submit} className="card" style={{ marginTop: "1.5rem" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="password">Password (min 8)</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </div>
        {error && (
          <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginBottom: "1rem" }}>{error}</p>
        )}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button className="btn btn-primary" type="submit">
            {mode === "login" ? "Sign in" : "Register"}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "New tenant…" : "Have account?"}
          </button>
        </div>
      </form>
    </main>
  );
}
