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

