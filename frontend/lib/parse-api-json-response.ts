/**
 * Parse fetch() response bodies from the backend.
 * When `ok` is true, invalid JSON throws a clear error (HTML from a mis-set NEXT_PUBLIC_API_URL is common on Vercel).
 * When `ok` is false, parse failures fall back to the raw string so callers can still show status text.
 */
export function parseApiResponseJson(
  text: string,
  ctx: { ok: boolean; status: number; url: string },
): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (ctx.ok) {
      const preview = trimmed.slice(0, 160).replace(/\s+/g, " ");
      throw new Error(
        [
          "The server returned a non-JSON body for a successful request.",
          "On Vercel, set NEXT_PUBLIC_API_URL to your FastAPI origin (e.g. https://api.example.com), not the Next.js site URL.",
          `GET/POST ${ctx.url} → HTTP ${ctx.status}`,
          `Preview: ${preview}${trimmed.length > 160 ? "…" : ""}`,
        ].join(" "),
      );
    }
    return text;
  }
}
