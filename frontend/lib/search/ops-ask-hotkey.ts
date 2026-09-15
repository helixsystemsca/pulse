/** Shared Ask / Search keyboard shortcut (Cmd/Ctrl+K). */

export function isOpsAskHotkey(e: KeyboardEvent): boolean {
  return (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !e.altKey && !e.shiftKey;
}

export function opsAskShortcutLabel(): string {
  if (typeof navigator === "undefined") return "Ctrl+K";
  const mac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  return mac ? "⌘K" : "Ctrl+K";
}
