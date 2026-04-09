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
    headers: {
      "Content-Type": "application/json",
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

