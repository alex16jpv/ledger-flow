"use client";

import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { env } from "@/lib/env";
import { useTheme } from "@/lib/theme";

import { type CaptchaAction, HumanCheckError, loadTurnstile, type TurnstileApi } from "./turnstile";

const COMPACT_BELOW_PX = 340;

interface Widget {
  api: TurnstileApi;
  id: string;
}

interface Waiting {
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}

export interface HumanCheck {
  mount: (element: HTMLDivElement | null) => void;
  interactive: boolean;
  token: () => Promise<string>;
}

export function useHumanCheck(action: CaptchaAction): HumanCheck {
  const locale = useLocale();
  const { resolvedMode } = useTheme();
  const [container, mount] = useState<HTMLDivElement | null>(null);
  const widget = useRef<Promise<Widget> | null>(null);
  const waiting = useRef<Waiting | null>(null);
  const spent = useRef(false);
  const [interactive, setInteractive] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const settle = useCallback((outcome: { token: string } | { error: Error }) => {
    const current = waiting.current;
    waiting.current = null;
    setInteractive(false);
    if (!current) return;
    if ("token" in outcome) current.resolve(outcome.token);
    else current.reject(outcome.error);
  }, []);

  useEffect(() => {
    if (!container) return undefined;
    const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const state = { closed: false, rendered: null as Widget | null };
    const mounting = (async (): Promise<Widget> => {
      if (!siteKey) throw new HumanCheckError("no site key is configured");
      const api = await loadTurnstile();
      if (state.closed) throw new HumanCheckError("the screen closed");
      const id = api.render(container, {
        sitekey: siteKey,
        action,
        appearance: "interaction-only",
        execution: "execute",
        language: locale,
        theme: resolvedMode,
        size: container.clientWidth < COMPACT_BELOW_PX ? "compact" : "normal",
        retry: "never",
        "refresh-expired": "manual",
        "response-field": false,
        callback: (token) => {
          settle({ token });
        },
        "error-callback": (code) => {
          settle({ error: new HumanCheckError(`error ${code}`) });
          return true;
        },
        "timeout-callback": () => {
          settle({ error: new HumanCheckError("the box was not ticked in time") });
        },
        "before-interactive-callback": () => {
          setInteractive(true);
        },
        "after-interactive-callback": () => {
          setInteractive(false);
        },
      });
      if (!id) throw new HumanCheckError("the widget did not render");
      state.rendered = { api, id };
      spent.current = false;
      return state.rendered;
    })();
    mounting.catch(() => undefined);
    widget.current = mounting;
    return () => {
      state.closed = true;
      if (state.rendered) state.rendered.api.remove(state.rendered.id);
      widget.current = null;
      settle({ error: new HumanCheckError("the screen closed") });
    };
  }, [container, action, locale, resolvedMode, settle, attempt]);

  const token = useCallback(async (): Promise<string> => {
    const mounting = widget.current;
    if (!mounting) throw new HumanCheckError("the check is not on screen");
    let rendered: Widget;
    try {
      rendered = await mounting;
    } catch (error) {
      setAttempt((current) => current + 1);
      throw error;
    }
    const { api, id } = rendered;
    settle({ error: new HumanCheckError("a newer token was asked for") });
    if (spent.current) api.reset(id);
    spent.current = true;
    return new Promise<string>((resolve, reject) => {
      waiting.current = { resolve, reject };
      api.execute(id);
    });
  }, [settle]);

  return { mount, interactive, token };
}

interface HumanCheckSlotProps {
  interactive: boolean;
  mount: (element: HTMLDivElement | null) => void;
  children: ReactNode;
}

// Clipped, not hidden, until Cloudflare asks for a tick: its frame has to stay rendered to run unseen.
export function HumanCheckSlot({ interactive, mount, children }: HumanCheckSlotProps) {
  const t = useTranslations("auth.humanCheck");
  return (
    <div className="flex flex-col">
      <div
        className={interactive ? "flex flex-col items-center gap-2 pb-5" : "h-0 overflow-hidden"}
      >
        {interactive && (
          <p className="text-center text-sm text-text-2" aria-live="polite">
            {t("prompt")}
          </p>
        )}
        <div ref={mount} className="max-w-full" />
      </div>
      {children}
    </div>
  );
}
