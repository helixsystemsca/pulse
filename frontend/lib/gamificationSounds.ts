"use client";

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

function beep(freq: number, durationMs: number, gain = 0.06) {
  const c = ctx();
  if (!c) return;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(c.destination);
  const t0 = c.currentTime;
  osc.start(t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

export function playXpTick() {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  beep(880, 70, 0.05);
}

export function playLevelUp() {
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  beep(523, 90, 0.07);
  window.setTimeout(() => beep(659, 100, 0.07), 80);
  window.setTimeout(() => beep(784, 140, 0.08), 170);
}
