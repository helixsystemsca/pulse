import { cva, type VariantProps } from "class-variance-authority";

/**
 * Global button tokens: rounded-xl, 2px border, surface-aware fills.
 * Use `<Button />` / `<ButtonLink />` or `buttonVariants({ surface, intent })` for raw `<button>`.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      surface: {
        light: "",
        dark: "",
      },
      intent: {
        primary: "",
        secondary: "",
        accent: "",
        danger: "",
      },
    },
    compoundVariants: [
      {
        surface: "light",
        intent: "primary",
        class:
          "border-black bg-sky-400 text-black hover:bg-sky-500 active:bg-sky-600 focus-visible:outline-black dark:border-white dark:bg-sky-500/25 dark:text-white dark:hover:bg-sky-400/35 dark:active:bg-sky-500/40 dark:focus-visible:outline-white",
      },
      {
        surface: "light",
        intent: "secondary",
        class:
          "border-black bg-neutral-200 text-black hover:bg-neutral-300 active:bg-neutral-400 focus-visible:outline-black dark:border-white dark:bg-transparent dark:text-white dark:hover:bg-white/10 dark:active:bg-white/[0.15] dark:focus-visible:outline-white",
      },
      {
        surface: "light",
        intent: "accent",
        class:
          "border-black bg-[var(--ds-success)] text-black hover:brightness-[0.92] active:brightness-[0.86] focus-visible:outline-black dark:border-white dark:bg-[color-mix(in_srgb,var(--ds-success)_32%,transparent)] dark:text-white dark:hover:brightness-[1.08] dark:active:brightness-[0.95] dark:focus-visible:outline-white",
      },
      {
        surface: "light",
        intent: "danger",
        class:
          "border-black bg-red-500 text-black hover:bg-red-600 active:bg-red-700 focus-visible:outline-black dark:border-white dark:bg-red-600/85 dark:text-white dark:hover:bg-red-600 dark:active:bg-red-700 dark:focus-visible:outline-white",
      },
      {
        surface: "dark",
        intent: "primary",
        class:
          "border-white bg-transparent text-white hover:bg-white/10 active:bg-white/[0.15] focus-visible:outline-white",
      },
      {
        surface: "dark",
        intent: "secondary",
        class:
          "border-white bg-transparent text-white hover:bg-white/10 active:bg-white/[0.15] focus-visible:outline-white",
      },
      {
        surface: "dark",
        intent: "accent",
        class:
          "border-white bg-[color-mix(in_srgb,var(--ds-success)_24%,transparent)] text-white hover:bg-[color-mix(in_srgb,var(--ds-success)_38%,transparent)] active:bg-[color-mix(in_srgb,var(--ds-success)_48%,transparent)] focus-visible:outline-white",
      },
      {
        surface: "dark",
        intent: "danger",
        class:
          "border-white bg-red-600/90 text-white hover:bg-red-600 active:bg-red-700 focus-visible:outline-white",
      },
    ],
    defaultVariants: {
      surface: "light",
      intent: "primary",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;

/** Maps legacy `variant` prop names to `intent` for the shared CVA. */
export type ButtonIntent = NonNullable<ButtonVariantProps["intent"]>;
export type ButtonSurface = NonNullable<ButtonVariantProps["surface"]>;
