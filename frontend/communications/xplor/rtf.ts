/** Light RTF → plain text pass (same behavior as legacy pipeline tool). */
export function stripRtfToPlain(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/\r\n/g, "\n");
  if (s.includes("{\\rtf")) {
    s = s
      .replace(/\{\\\*\\[^{}]*\}/g, "")
      .replace(/\\'[0-9a-fA-F]{2}/g, (m) => {
        const code = parseInt(m.slice(2), 16);
        return Number.isFinite(code) ? String.fromCharCode(code) : "";
      })
      .replace(/\\par\b/g, "\n")
      .replace(/\\line\b/g, "\n")
      .replace(/\\tab\b/g, "\t")
      .replace(/\\[a-z]+\d* ?/gi, "")
      .replace(/[{}]/g, "");
  }
  return s.replace(/\n{3,}/g, "\n\n").trim();
}
