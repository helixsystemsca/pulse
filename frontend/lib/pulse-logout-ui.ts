/** Dispatched immediately before session clear so a root-level overlay can paint first. */
export const PULSE_LOGOUT_SUCCESS_EVENT = "pulse-logout-success";

export function dispatchPulseLogoutSuccessUi(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PULSE_LOGOUT_SUCCESS_EVENT));
}
