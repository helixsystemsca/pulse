import { describe, expect, it } from "vitest";
import { isOpsAskHotkey } from "@/lib/search/ops-ask-hotkey";

describe("isOpsAskHotkey", () => {
  it("matches Cmd/Ctrl+K without extra modifiers", () => {
    expect(
      isOpsAskHotkey({ key: "k", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false } as KeyboardEvent),
    ).toBe(true);
    expect(
      isOpsAskHotkey({ key: "K", metaKey: false, ctrlKey: true, altKey: false, shiftKey: false } as KeyboardEvent),
    ).toBe(true);
    expect(
      isOpsAskHotkey({ key: "k", metaKey: true, ctrlKey: false, altKey: true, shiftKey: false } as KeyboardEvent),
    ).toBe(false);
  });
});
