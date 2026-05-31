"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScannerConnectionStatus = "connected" | "disconnected";

/** Recent scan / HID activity keeps the badge green. */
const SCANNER_ACTIVITY_TTL_MS = 45_000;

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
function isListeningForScanner(input: HTMLInputElement | null): boolean {
  if (!input || typeof document === "undefined") return false;
  return document.activeElement === input && !isManualInputFocused();
}

export function useBarcodeScannerInput({ enabled = true, maxInterKeyMs = 50, onScan }: Options) {
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const lastActivityAtRef = useRef(0);
  const [connectionStatus, setConnectionStatus] = useState<ScannerConnectionStatus>("disconnected");

  const touchScannerActivity = useCallback(() => {
    lastActivityAtRef.current = Date.now();
  }, []);

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

  useEffect(() => {
    if (!enabled) {
      setConnectionStatus("disconnected");
      return;
    }
    const evaluate = () => {
      const now = Date.now();
      const recentActivity = now - lastActivityAtRef.current < SCANNER_ACTIVITY_TTL_MS;
      const listening = isListeningForScanner(inputRef.current);
      setConnectionStatus(recentActivity || listening ? "connected" : "disconnected");
    };
    evaluate();
    const id = window.setInterval(evaluate, 500);
    const onFocusIn = () => evaluate();
    document.addEventListener("focusin", onFocusIn);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [enabled]);

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
        if (raw) {
          touchScannerActivity();
          onScan(raw);
        }
        return;
      }
      if (e.key.length === 1) {
        touchScannerActivity();
        bufferRef.current += e.key;
      }
    },
    [enabled, maxInterKeyMs, onScan, touchScannerActivity],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!enabled) return;
      const v = e.target.value;
      if (v.includes("\n") || v.includes("\r")) {
        const raw = v.replace(/[\r\n]+/g, "").trim();
        e.target.value = "";
        bufferRef.current = "";
        if (raw) {
          touchScannerActivity();
          onScan(raw);
        }
      }
    },
    [enabled, onScan, touchScannerActivity],
  );

  return { inputRef, handleKeyDown, handleChange, focusInput, connectionStatus };
}
