"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallState = "unavailable" | "available" | "installed";

// Chromium fires beforeinstallprompt when the app is installable; Safari never does, so the row hides there.
const STANDALONE = "(display-mode: standalone)";

function subscribeStandalone(onChange: () => void) {
  const media = window.matchMedia(STANDALONE);
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

export function useInstallPrompt(): { state: InstallState; install: () => Promise<void> } {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const installed = useSyncExternalStore(
    subscribeStandalone,
    () => window.matchMedia(STANDALONE).matches,
    () => false,
  );

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setPrompt(null);
  }, [prompt]);

  return { state: installed ? "installed" : prompt ? "available" : "unavailable", install };
}
