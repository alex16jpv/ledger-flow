import { TURNSTILE_ORIGIN } from "@/lib/security/csp";

export type CaptchaAction = "forgot-password" | "register" | "verify-email";

export interface TurnstileOptions {
  sitekey: string;
  action: CaptchaAction;
  appearance: "interaction-only";
  execution: "execute";
  language: string;
  theme: "light" | "dark";
  size: "normal" | "compact";
  retry: "never";
  "refresh-expired": "manual";
  "response-field": false;
  callback: (token: string) => void;
  "error-callback": (code: string) => boolean;
  "timeout-callback": () => void;
  "before-interactive-callback": () => void;
  "after-interactive-callback": () => void;
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileOptions) => string | null | undefined;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SCRIPT_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;

export class HumanCheckError extends Error {
  constructor(reason: string) {
    super(`Cloudflare's check did not answer with a token: ${reason}`);
    this.name = "HumanCheckError";
  }
}

let loading: Promise<TurnstileApi> | null = null;

export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    const fail = (reason: string) => {
      loading = null;
      script.remove();
      reject(new HumanCheckError(reason));
    };
    script.addEventListener("load", () => {
      if (window.turnstile) resolve(window.turnstile);
      else fail("the script loaded without its API");
    });
    script.addEventListener("error", () => {
      fail("the script did not load");
    });
    document.head.append(script);
  });
  return loading;
}

export function resetTurnstileLoaderForTests(): void {
  loading = null;
}
