import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInstallPrompt } from "./install";
import { INSTALL_INIT_SCRIPT, INSTALL_STATE_GLOBAL } from "./install-script";

function runHeadScript(): void {
  new Function(INSTALL_INIT_SCRIPT)();
}

function fireInstallPrompt(): Event & { prompt: () => Promise<void> } {
  // The real event is cancelable; without it `preventDefault()` is a no-op and proves nothing.
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome: "accepted" });
  window.dispatchEvent(event);
  return event;
}

describe("useInstallPrompt", () => {
  beforeEach(() => {
    (window as unknown as Record<string, unknown>)[INSTALL_STATE_GLOBAL] = undefined;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  // The bug the owner hit in production: the browser fires the event on the screen the user landed
  // on, and Settings mounts much later, so the row never appeared.
  it("reports an install captured before the hook ever mounted", () => {
    runHeadScript();
    fireInstallPrompt();

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.state).toBe("available");
  });

  it("reports one captured while the hook is mounted", () => {
    runHeadScript();
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("unavailable");

    act(() => {
      fireInstallPrompt();
    });

    expect(result.current.state).toBe("available");
  });

  it("keeps the browser’s own banner from firing, so the app owns the invitation", () => {
    runHeadScript();
    const event = fireInstallPrompt();
    expect(event.defaultPrevented).toBe(true);
  });

  it("prompts with the captured event and forgets it once accepted", async () => {
    runHeadScript();
    const event = fireInstallPrompt();
    const { result } = renderHook(() => useInstallPrompt());

    await act(async () => {
      await result.current.install();
    });

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("unavailable");
  });

  it("says installed once the app runs standalone", () => {
    runHeadScript();
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.state).toBe("installed");
  });

  it("stays quiet when the head script never ran", () => {
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current.state).toBe("unavailable");
  });
});
