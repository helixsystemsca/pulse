const SHELL_SELECTOR = "[data-pulse-app-shell]";

/** Subtle scale + dim on the app shell when premium overlays open (modals / drawers). */
export function setShellPremiumOverlay(open: boolean, opts?: { reducedMotion?: boolean }) {
  if (typeof document === "undefined") return;
  const el = document.querySelector<HTMLElement>(SHELL_SELECTOR);
  if (!el) return;
  if (!open || opts?.reducedMotion) {
    el.style.removeProperty("transform");
    el.style.removeProperty("filter");
    el.style.removeProperty("transition");
    return;
  }
  el.style.transition = "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms cubic-bezier(0.22, 1, 0.36, 1)";
  el.style.transform = "scale(0.985)";
  el.style.filter = "brightness(0.97)";
}
