import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode, useEffect } from "react";

import { ThemeProvider } from "@/lib/theme";
import en from "@/messages/en.json";

import {
  resetTurnstileLoaderForTests,
  type TurnstileApi,
  type TurnstileOptions,
} from "./turnstile";
import { type HumanCheck, HumanCheckSlot, useHumanCheck } from "./useHumanCheck";

vi.mock("@/lib/env", () => ({ env: { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site-key" } }));

let options: TurnstileOptions | null = null;
const api = {
  render: vi.fn((_container: HTMLElement, given: TurnstileOptions) => {
    options = given;
    return "widget-1";
  }),
  execute: vi.fn(),
  reset: vi.fn(),
  remove: vi.fn(),
} satisfies TurnstileApi;

let check: HumanCheck | null = null;

function Probe() {
  const probed = useHumanCheck("forgot-password");
  useEffect(() => {
    check = probed;
  });
  return (
    <HumanCheckSlot interactive={probed.interactive} mount={probed.mount}>
      <button type="button">Send code</button>
    </HumanCheckSlot>
  );
}

function renderProbe() {
  return render(<Probe />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider locale="es" messages={en}>
        <ThemeProvider>{children}</ThemeProvider>
      </NextIntlClientProvider>
    ),
  });
}

const current = (): HumanCheck => {
  if (!check) throw new Error("the probe did not render");
  return check;
};

beforeEach(() => {
  options = null;
  check = null;
  Object.values(api).forEach((fn) => fn.mockClear());
  window.turnstile = api;
  resetTurnstileLoaderForTests();
});

afterEach(() => {
  delete window.turnstile;
});

async function rendered() {
  await vi.waitFor(() => {
    expect(api.render).toHaveBeenCalled();
  });
}

describe("useHumanCheck", () => {
  it("renders Cloudflare's widget unseen, for the action, in the app's language", async () => {
    renderProbe();
    await rendered();
    expect(options).toMatchObject({
      sitekey: "site-key",
      action: "forgot-password",
      appearance: "interaction-only",
      execution: "execute",
      language: "es",
      retry: "never",
    });
    expect(api.execute).not.toHaveBeenCalled();
  });

  it("asks for a token only when sending, and a fresh one each time", async () => {
    renderProbe();
    await rendered();
    const first = current().token();
    await vi.waitFor(() => {
      expect(api.execute).toHaveBeenCalledTimes(1);
    });
    act(() => options?.callback("token-1"));
    await expect(first).resolves.toBe("token-1");
    expect(api.reset).not.toHaveBeenCalled();

    const second = current().token();
    await vi.waitFor(() => {
      expect(api.execute).toHaveBeenCalledTimes(2);
    });
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    act(() => options?.callback("token-2"));
    await expect(second).resolves.toBe("token-2");
  });

  it("fails the send when Cloudflare says no", async () => {
    renderProbe();
    await rendered();
    const asked = current().token();
    await vi.waitFor(() => {
      expect(api.execute).toHaveBeenCalled();
    });
    act(() => {
      options?.["error-callback"]("600010");
    });
    await expect(asked).rejects.toThrow(/error 600010/);
  });

  it("shows the line above the box only while Cloudflare wants a tick", async () => {
    renderProbe();
    await rendered();
    expect(screen.queryByText(/tick the box/)).not.toBeInTheDocument();
    act(() => {
      options?.["before-interactive-callback"]();
    });
    expect(screen.getByText(/One more step: tick the box/)).toBeInTheDocument();
    act(() => {
      options?.["after-interactive-callback"]();
    });
    expect(screen.queryByText(/tick the box/)).not.toBeInTheDocument();
  });

  it("mounts again after a failed load, so the next press can pass", async () => {
    delete window.turnstile;
    renderProbe();
    const script = () =>
      document.head.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com"]');
    await vi.waitFor(() => {
      expect(script()).not.toBeNull();
    });
    act(() => {
      script()?.dispatchEvent(new Event("error"));
    });
    await expect(current().token()).rejects.toThrow(/did not load/);

    window.turnstile = api;
    await rendered();
    const asked = current().token();
    await vi.waitFor(() => {
      expect(api.execute).toHaveBeenCalled();
    });
    act(() => options?.callback("token-after"));
    await expect(asked).resolves.toBe("token-after");
  });

  it("removes the widget when the screen closes", async () => {
    const { unmount } = renderProbe();
    await rendered();
    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });
});
