import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useInstallPrompt } from "./install";
import { INSTALL_INIT_SCRIPT, INSTALL_STATE_GLOBAL } from "./install-script";

function runHeadScript(): void {
  new Function(INSTALL_INIT_SCRIPT)();
}

function fireInstallPrompt(
  outcome: "accepted" | "dismissed" = "accepted",
): Event & { prompt: () => Promise<void> } {
  // The real event is cancelable; without it `preventDefault()` is a no-op and proves nothing.
  const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
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

  // The browser fires the event on the landing screen, and Settings mounts much later.
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

  // Owner's call (2026-09-08): the browser's own invitation stays and the row is a second way in.
  it("lets the browser show its own invitation and keeps the event anyway", () => {
    runHeadScript();
    const event = fireInstallPrompt();

    expect(event.defaultPrevented).toBe(false);
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.state).toBe("available");
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

  // T-197: a second tap on a dismissed prompt used to call it again, which the browser rejects.
  it("spends the event on a dismissal too, so nothing offers a prompt that can no longer open", async () => {
    runHeadScript();
    const event = fireInstallPrompt("dismissed");
    const { result } = renderHook(() => useInstallPrompt());

    await act(async () => {
      await result.current.install();
    });
    await act(async () => {
      await result.current.install();
    });

    expect(event.prompt).toHaveBeenCalledOnce();
    expect(result.current.state).toBe("unavailable");
  });

  // The Home card and the sheet it opens both listen; only the last one to mount used to hear.
  it("tells every mounted listener about an offer that arrives late", () => {
    runHeadScript();
    const card = renderHook(() => useInstallPrompt());
    const sheet = renderHook(() => useInstallPrompt());

    act(() => {
      fireInstallPrompt();
    });

    expect(card.result.current.state).toBe("available");
    expect(sheet.result.current.state).toBe("available");
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
