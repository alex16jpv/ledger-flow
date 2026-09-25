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

// F-87: Safari never fires `beforeinstallprompt`, and the event is not cancelled either.
const STANDALONE = "(display-mode: standalone)";

function store(): InstallState | null {
  if (typeof window === "undefined") return null;
  return (
    (window as unknown as Record<string, InstallState | undefined>)[INSTALL_STATE_GLOBAL] ?? null
  );
}

const listeners = new Set<() => void>();

function notifyAll(): void {
  for (const listener of listeners) listener();
}

// The head script owns the capture; this only relays its changes to React.
function subscribe(onChange: () => void): () => void {
  const state = store();
  listeners.add(onChange);
  if (state) state.notify = notifyAll;
  const media = window.matchMedia(STANDALONE);
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    listeners.delete(onChange);
    if (state && listeners.size === 0) state.notify = null;
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
    // An event prompts once: calling it again after a dismissal throws.
    captured.event = null;
    captured.notify?.();
    await event.prompt();
    await event.userChoice;
  }, []);

  return { state, install };
}
