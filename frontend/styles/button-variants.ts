/**
 * Shared button styling — layout + tone from `button-colors.ts`.
 * Use `<Button />` / `<ButtonLink />` or `buttonVariants({ surface, intent })` for raw `<button>`.
 */

import { resolveButtonAppearance, type ButtonIntent, type ButtonSurface } from "./button-colors";

export { resolveButtonAppearance };
export type { ButtonIntent, ButtonSurface };

export type ButtonVariantProps = {
  surface?: ButtonSurface;
  intent?: ButtonIntent;
};

export function buttonVariants(opts: ButtonVariantProps): string {
  const surface = opts.surface ?? "light";
  const intent = opts.intent ?? "primary";
  return resolveButtonAppearance({ surface, intent });
}
