"use client";

import { useCallback, useEffect, useRef } from "react";

type Options = {
  enabled?: boolean;
  /** Minimum ms between keystrokes to treat input as scanner (default 50). */
  maxInterKeyMs?: number;
  onScan: (value: string) => void;
};

function isManualInputFocused(): boolean {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  if (el instanceof HTMLElement && el.dataset.scannerHidden === "true") return false;
  return el.matches('input, textarea, select, [contenteditable="true"]');
}

/**
 * USB/BLE HID scanners behave like a keyboard: rapid chars ending with Enter.
 * Uses a hidden input kept focused for reliability on tablets.
 */
export function useBarcodeScannerInput({ enabled = true, maxInterKeyMs = 50, onScan }: Options) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);

  const focusInput = useCallback(() => {
    if (!enabled || isManualInputFocused()) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    focusInput();
    const id = window.setInterval(focusInput, 2500);
    const onPointer = () => {
      window.setTimeout(focusInput, 0);
    };
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [enabled, focusInput]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!enabled) return;
      const now = Date.now();
      if (now - lastKeyAtRef.current > maxInterKeyMs) {
        bufferRef.current = "";
      }
      lastKeyAtRef.current = now;

      if (e.key === "Enter") {
        e.preventDefault();
        const raw = bufferRef.current.trim();
        bufferRef.current = "";
        if (inputRef.current) inputRef.current.value = "";
        if (raw) onScan(raw);
        return;
      }
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }
    },
    [enabled, maxInterKeyMs, onScan],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!enabled) return;
      const v = e.target.value;
      if (v.includes("\n") || v.includes("\r")) {
        const raw = v.replace(/[\r\n]+/g, "").trim();
        e.target.value = "";
        bufferRef.current = "";
        if (raw) onScan(raw);
      }
    },
    [enabled, onScan],
  );

  return { inputRef, handleKeyDown, handleChange, focusInput };
}
