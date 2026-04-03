/** Dispatches a proximity hint for {@link ProximityPromptHost} (BLE gateway or diagnostics). */
export const PULSE_PROXIMITY_EVENT = "pulse-proximity";

export type PulseProximityDetail = { locationTagId: string };

export function dispatchPulseProximityEvent(locationTagId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PulseProximityDetail>(PULSE_PROXIMITY_EVENT, { detail: { locationTagId } }));
}
