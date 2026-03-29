/**
 * Typed helpers for the FastAPI backend. JWT is read from localStorage (demo).
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("oi_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("oi_token", token);
  else localStorage.removeItem("oi_token");
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const headers: HeadersInit = {
    ...(init.headers as Record<string, string>),
  };
  const token = getToken();
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let body: BodyInit | undefined =
    init.body === null ? undefined : (init.body as BodyInit | undefined);
  if (init.json !== undefined) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
    body = JSON.stringify(init.json);
  }

  const res = await fetch(`${API}${path}`, { ...init, headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
