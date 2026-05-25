/** One-line greeting on the first tour step (replaces the old start modal). */
export function formatTourWelcomeLine(title: string): string {
  const t = title.trim();
  if (!t) return "Welcome";
  if (/^welcome\b/i.test(t)) return t;
  return `Welcome to ${t}`;
}
