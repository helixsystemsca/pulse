/**
 * Shared button appearance: outlined “ghost” controls (no contrast-aware surface pairing).
 * Light surfaces: transparent fill, black border, black text.
 * Dark surfaces (e.g. accent bars): transparent fill, white border, white text.
 */

export type ButtonIntent = "primary" | "secondary" | "accent" | "danger" | "highlight" | "pink";

export type ButtonSurface = "light" | "dark";

const LAYOUT =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

const LIGHT_BASE =
  "border-black bg-transparent text-black hover:bg-black/[0.06] active:bg-black/[0.10] focus-visible:outline-black";

const LIGHT_DANGER =
  "border-black bg-transparent text-red-700 hover:bg-red-50 active:bg-red-100 focus-visible:outline-black";

const DARK_BASE =
  "border-white bg-transparent text-white hover:bg-white/10 active:bg-white/[0.15] focus-visible:outline-white";

const DARK_DANGER =
  "border-white bg-transparent text-red-200 hover:bg-red-500/25 active:bg-red-500/35 focus-visible:outline-white";

function cnParts(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export type ButtonResolveOpts = {
  surface: ButtonSurface;
  intent: ButtonIntent;
};

/** Full Tailwind class string for a button (layout + tone). */
export function resolveButtonAppearance(opts: ButtonResolveOpts): string {
  const { surface, intent } = opts;
  if (surface === "dark") {
    return cnParts(LAYOUT, intent === "danger" ? DARK_DANGER : DARK_BASE);
  }
  return cnParts(LAYOUT, intent === "danger" ? LIGHT_DANGER : LIGHT_BASE);
}
