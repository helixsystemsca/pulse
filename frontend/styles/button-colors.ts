/**
 * Shared button appearance: outlined “ghost” controls (ice-blue hover / deeper ice on press).
 */

export type ButtonIntent = "primary" | "secondary" | "accent" | "danger" | "highlight" | "pink";

export type ButtonSurface = "light" | "dark";

const LAYOUT =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

const LIGHT_BASE =
  "border-sky-400/85 bg-transparent text-slate-800 hover:bg-sky-400/16 active:bg-sky-500/24 focus-visible:outline-sky-500/70";

const LIGHT_DANGER =
  "border-black bg-transparent text-red-700 hover:bg-red-50 active:bg-red-100 focus-visible:outline-black";

const DARK_BASE =
  "border-sky-200/70 bg-transparent text-white hover:bg-sky-300/22 active:bg-sky-400/32 focus-visible:outline-sky-200/55";

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
