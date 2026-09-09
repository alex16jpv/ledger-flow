"use client";

import { useCallback, useSyncExternalStore } from "react";

import { INSTALL_STATE_GLOBAL } from "./install-script";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  event: BeforeInstallPromptEvent | null;
  installed: boolean;
  notify: (() => void) | null;
}

export type InstallPromptState = "unavailable" | "available" | "installed";

// Chromium fires beforeinstallprompt when the app is installable; Safari never does, so the row
// falls back to the manual steps instead of hiding (F-87). The event is not cancelled, so the
// browser's own invitation still appears and this row is the second way in, not the only one.
const STANDALONE = "(display-mode: standalone)";

function store(): InstallState | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as Record<string, InstallState | undefined>)[INSTALL_STATE_GLOBAL] ?? null
  );
}

// The head script owns the capture; this only relays its changes to React.
function subscribe(onChange: () => void): () => void {
  const state = store();
  if (state) state.notify = onChange;
  const media = window.matchMedia(STANDALONE);
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    if (state?.notify === onChange) state.notify = null;
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

function snapshot(): InstallPromptState {
  const state = store();
  if (window.matchMedia(STANDALONE).matches || state?.installed) return "installed";
  return state?.event ? "available" : "unavailable";
}

export function useInstallPrompt(): {
  state: InstallPromptState;
  install: () => Promise<void>;
} {
  const state = useSyncExternalStore(subscribe, snapshot, () => "unavailable" as const);

  const install = useCallback(async () => {
    const captured = store();
    const event = captured?.event;
    if (!captured || !event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      captured.event = null;
      captured.notify?.();
    }
  }, []);

  return { state, install };
}
