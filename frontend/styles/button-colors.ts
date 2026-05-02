/**
 * Contrast-aware button tones: when a button’s hue matches the parent `surfaceColor`,
 * the darker `contrast` fill is used so the control stays distinct from the background.
 */
export const BUTTON_COLORS = {
  blue: {
    base: "bg-sky-400 hover:bg-sky-500 active:bg-sky-600",
    contrast: "bg-sky-600 hover:bg-sky-700 active:bg-sky-800",
  },
  teal: {
    base: "bg-[var(--ds-success)] hover:brightness-[0.92] active:brightness-[0.86]",
    contrast: "bg-teal-800 hover:bg-teal-900 active:bg-teal-950",
  },
  yellow: {
    base: "bg-amber-300 hover:bg-amber-400 active:bg-amber-500",
    contrast: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
  },
  pink: {
    base: "bg-pink-400 hover:bg-pink-500 active:bg-pink-600",
    contrast: "bg-pink-600 hover:bg-pink-700 active:bg-pink-800",
  },
} as const;

export type ButtonColorKey = keyof typeof BUTTON_COLORS;

/** Parent / section surface the button sits on (for clash detection). */
export type ButtonSurfaceContext = ButtonColorKey | "white" | "dark";

export type ButtonIntent = "primary" | "secondary" | "accent" | "danger" | "highlight" | "pink";

export type ButtonSurface = "light" | "dark";

const LAYOUT =
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

/** Maps intent → chromatic key used for BUTTON_COLORS (null = not in BUTTON_COLORS). */
function intentToButtonColor(intent: ButtonIntent): ButtonColorKey | null {
  switch (intent) {
    case "primary":
      return "blue";
    case "accent":
      return "teal";
    case "highlight":
      return "yellow";
    case "pink":
      return "pink";
    default:
      return null;
  }
}

function pickChromaticTone(buttonColor: ButtonColorKey, surfaceColor: ButtonSurfaceContext | undefined): "base" | "contrast" {
  if (surfaceColor === undefined || surfaceColor === "dark") return "base";
  if (surfaceColor === buttonColor) return "contrast";
  return "base";
}

/** Neutral fills when intent is secondary — clash against white panels. */
const NEUTRAL_LIGHT = {
  base: "border-black bg-neutral-200 text-black hover:bg-neutral-300 active:bg-neutral-400 focus-visible:outline-black",
  contrast:
    "border-black bg-neutral-400 text-black hover:bg-neutral-500 active:bg-neutral-600 focus-visible:outline-black",
};

const NEUTRAL_LIGHT_DARK_OS =
  "dark:border-white dark:bg-transparent dark:text-white dark:hover:bg-white/10 dark:active:bg-white/[0.15] dark:focus-visible:outline-white";

const SECONDARY_LIGHT_CONTRAST_DARK_OS =
  "dark:border-white dark:bg-white/15 dark:text-white dark:hover:bg-white/20 dark:active:bg-white/25 dark:focus-visible:outline-white";

const DANGER_LIGHT = {
  base: "border-black bg-red-500 text-black hover:bg-red-600 active:bg-red-700 focus-visible:outline-black",
  contrast: "border-black bg-red-700 text-black hover:bg-red-800 active:bg-red-900 focus-visible:outline-black",
};

const DANGER_LIGHT_DARK_OS =
  "dark:border-white dark:bg-red-600/85 dark:text-white dark:hover:bg-red-600 dark:active:bg-red-700 dark:focus-visible:outline-white";

const DANGER_LIGHT_CONTRAST_DARK_OS =
  "dark:border-white dark:bg-red-800/90 dark:text-white dark:hover:bg-red-700 dark:active:bg-red-800 dark:focus-visible:outline-white";

/** `.dark` theme overlays for chromatic buttons on light surfaces. */
const CHROMATIC_DARK_OS: Record<ButtonColorKey, { base: string; contrast: string }> = {
  blue: {
    base: "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-sky-500/25 dark:hover:bg-sky-400/35 dark:active:bg-sky-500/40",
    contrast:
      "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-sky-700/35 dark:hover:bg-sky-600/45 dark:active:bg-sky-800/45",
  },
  teal: {
    base: "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-[color-mix(in_srgb,var(--ds-success)_32%,transparent)] dark:hover:brightness-[1.08] dark:active:brightness-[0.95]",
    contrast:
      "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-teal-900/55 dark:hover:bg-teal-800/65 dark:active:bg-teal-950/75",
  },
  yellow: {
    base: "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-amber-400/28 dark:hover:bg-amber-400/38 dark:active:bg-amber-500/36",
    contrast:
      "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-amber-700/40 dark:hover:bg-amber-600/48 dark:active:bg-amber-800/52",
  },
  pink: {
    base: "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-pink-500/28 dark:hover:bg-pink-400/38 dark:active:bg-pink-600/36",
    contrast:
      "dark:border-white dark:text-white dark:focus-visible:outline-white dark:bg-pink-700/42 dark:hover:bg-pink-600/50 dark:active:bg-pink-800/55",
  },
};

function chromaticLightAppearance(intent: ButtonIntent, surfaceColor: ButtonSurfaceContext | undefined): string {
  const key = intentToButtonColor(intent);
  if (!key) return "";
  const tone = pickChromaticTone(key, surfaceColor);
  const fill = BUTTON_COLORS[key][tone];
  const darkOs = CHROMATIC_DARK_OS[key][tone];
  return cnParts(
    "border-black text-black focus-visible:outline-black",
    fill,
    darkOs,
  );
}

function cnParts(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function lightAppearance(intent: ButtonIntent, surfaceColor: ButtonSurfaceContext | undefined): string {
  const chromatic = intentToButtonColor(intent);
  if (chromatic) {
    return chromaticLightAppearance(intent, surfaceColor);
  }
  if (intent === "secondary") {
    const tone =
      surfaceColor === undefined || surfaceColor === "dark"
        ? "base"
        : surfaceColor === "white"
          ? "contrast"
          : "base";
    const shell = tone === "contrast" ? NEUTRAL_LIGHT.contrast : NEUTRAL_LIGHT.base;
    const darkOs = tone === "contrast" ? SECONDARY_LIGHT_CONTRAST_DARK_OS : NEUTRAL_LIGHT_DARK_OS;
    return cnParts(shell, darkOs);
  }
  if (intent === "danger") {
    const tone = surfaceColor === "pink" ? "contrast" : "base";
    const shell = tone === "contrast" ? DANGER_LIGHT.contrast : DANGER_LIGHT.base;
    const darkOs = tone === "contrast" ? DANGER_LIGHT_CONTRAST_DARK_OS : DANGER_LIGHT_DARK_OS;
    return cnParts(shell, darkOs);
  }
  return "";
}

function darkAppearance(intent: ButtonIntent): string {
  switch (intent) {
    case "primary":
    case "secondary":
      return "border-white bg-transparent text-white hover:bg-white/10 active:bg-white/[0.15] focus-visible:outline-white";
    case "accent":
      return "border-white bg-[color-mix(in_srgb,var(--ds-success)_24%,transparent)] text-white hover:bg-[color-mix(in_srgb,var(--ds-success)_38%,transparent)] active:bg-[color-mix(in_srgb,var(--ds-success)_48%,transparent)] focus-visible:outline-white";
    case "highlight":
      return "border-white bg-amber-400/25 text-white hover:bg-amber-400/38 active:bg-amber-500/32 focus-visible:outline-white";
    case "pink":
      return "border-white bg-pink-500/25 text-white hover:bg-pink-400/35 active:bg-pink-600/32 focus-visible:outline-white";
    case "danger":
      return "border-white bg-red-600/90 text-white hover:bg-red-600 active:bg-red-700 focus-visible:outline-white";
    default:
      return "";
  }
}

export type ButtonResolveOpts = {
  surface: ButtonSurface;
  intent: ButtonIntent;
  /** Background hue / tone of the containing surface (optional → always base chromatic fill). */
  surfaceColor?: ButtonSurfaceContext;
};

/**
 * Full Tailwind class string for a button (layout + tone).
 * All contrast logic lives here so callers stay declarative.
 */
export function resolveButtonAppearance(opts: ButtonResolveOpts): string {
  const { surface, intent, surfaceColor } = opts;
  if (surface === "dark") {
    return cnParts(LAYOUT, darkAppearance(intent));
  }
  return cnParts(LAYOUT, lightAppearance(intent, surfaceColor));
}
