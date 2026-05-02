/**
 * Shared button styling — layout + tone resolved in `button-colors.ts` (contrast-aware).
 * Use `<Button />` / `<ButtonLink />` or `buttonVariants({ surface, intent, surfaceColor })` for raw `<button>`.
 */

import {
  BUTTON_COLORS,
  resolveButtonAppearance,
  type ButtonIntent,
  type ButtonSurface,
  type ButtonSurfaceContext,
} from "./button-colors";

export { BUTTON_COLORS, resolveButtonAppearance };
export type { ButtonIntent, ButtonSurface, ButtonSurfaceContext };

export type ButtonVariantProps = {
  surface?: ButtonSurface;
  intent?: ButtonIntent;
  /** Parent surface hue — when it matches the button’s chromatic hue, a darker contrast fill is used. */
  surfaceColor?: ButtonSurfaceContext;
};

export function buttonVariants(opts: ButtonVariantProps): string {
  const surface = opts.surface ?? "light";
  const intent = opts.intent ?? "primary";
  return resolveButtonAppearance({
    surface,
    intent,
    surfaceColor: opts.surfaceColor,
  });
}
