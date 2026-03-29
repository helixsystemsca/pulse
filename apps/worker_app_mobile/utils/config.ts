import Constants from "expo-constants";

/** REST + WS base (no trailing slash). */
export function getApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const raw = fromExtra?.trim() || "http://localhost:8000";
  return raw.replace(/\/$/, "");
}

export function getWsBaseUrl(): string {
  return getApiBaseUrl().replace(/^http/i, (m) => (m.toLowerCase() === "https" ? "wss" : "ws"));
}

export const TOKEN_KEY = "oi_worker_jwt";
