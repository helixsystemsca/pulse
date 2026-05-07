/** Dispatched immediately before session clear so a root-level overlay can paint first. */
export const PULSE_LOGOUT_SUCCESS_EVENT = "pulse-logout-success";

/**
 * How long the signed-out overlay stays fully visible before it begins to close (ms).
 * UX intent: allow a brief "signed out" moment, but navigate to login in the background.
 */
export const PULSE_LOGOUT_SUCCESS_DISPLAY_MS = 3800;

/** Exit fade — keep in sync with `LogoutSuccessModal` framer-motion duration. */
export const PULSE_LOGOUT_SUCCESS_EXIT_MS = 220;

/**
 * Delay session clear + login redirect long enough for the overlay to paint first.
 * (Navigation happens quickly; the overlay remains mounted across routes.)
 */
export function pulseLogoutNavigationDelayMs(): number {
  return 120;
}

export function dispatchPulseLogoutSuccessUi(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PULSE_LOGOUT_SUCCESS_EVENT));
}
