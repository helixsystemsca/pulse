import Constants from "expo-constants";

/** REST base URL (no trailing slash). Matches FastAPI typical mount. */
export function getApiBaseUrl(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  const raw = fromExtra?.trim() || "http://localhost:8000";
  return raw.replace(/\/$/, "");
}

/** API prefix for versioned routes (adjust to match backend). */
export const API_PREFIX = "/api/v1";

export const SESSION_KEY = "field_operator_session_v1";
