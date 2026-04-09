export type ApiConfig = {
  baseUrl: string;
};

let cfg: ApiConfig = {
  // Placeholder — point this at your existing Pulse backend host.
  // Example: "https://pulse.helixsystems.ca"
  baseUrl: "",
};

export function configureApi(next: Partial<ApiConfig>) {
  cfg = { ...cfg, ...next };
}

/** Sync `EXPO_PUBLIC_API_BASE_URL` into the client (call before any authenticated request). */
export function ensureApiConfiguredFromEnv() {
  const base = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim();
  if (base) configureApi({ baseUrl: base });
}

export function parsePulseApiErrorMessage(raw: string): string {
  const t = (raw ?? "").trim();
  if (!t) return "Request failed";
  try {
    const j = JSON.parse(t) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail) && j.detail.length > 0) {
      const row = j.detail[0] as { msg?: string };
      if (row && typeof row.msg === "string") return row.msg;
    }
  } catch {
    /* plain text or HTML */
  }
  return t.length > 240 ? "Request failed" : t;
}

export function getApiBaseUrl(): string {
  return cfg.baseUrl;
}

export function resolveApiUrl(pathOrUrl: string | null | undefined): string | null {
  const s = (pathOrUrl ?? "").trim();
  if (!s) return null;
  // Already absolute (http/https/file/etc).
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(s)) return s;
  // Absolute path relative to API host.
  if (s.startsWith("/")) {
    if (!cfg.baseUrl) return null;
    return `${cfg.baseUrl.replace(/\/$/, "")}${s}`;
  }
  // Unknown/relative-ish; return as-is and let caller decide.
  return s;
}

export async function apiFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string } = {},
): Promise<T> {
  if (!cfg.baseUrl) {
    throw new Error("API baseUrl is not configured");
  }
  const url = `${cfg.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(parsePulseApiErrorMessage(msg) || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

/** POST `multipart/form-data`. Do not set `Content-Type` — the runtime sets the boundary. */
export async function apiPostFormData<T>(
  path: string,
  formData: FormData,
  opts: { token?: string } = {},
): Promise<T> {
  if (!cfg.baseUrl) {
    throw new Error("API baseUrl is not configured");
  }
  const url = `${cfg.baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(url, { method: "POST", cache: "no-store", headers, body: formData });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(parsePulseApiErrorMessage(msg) || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

