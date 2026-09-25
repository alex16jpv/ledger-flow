import { afterEach, describe, expect, it, vi } from "vitest";

import { chromeIntentUrl, devicePlatform, installGuide } from "./platform";

// jsdom's Navigator ships no maxTouchPoints at all, so it is defined here rather than spied on.
function pretend(userAgent: string, maxTouchPoints = 0) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 Chrome/131";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131";
const TOUCH_WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131";

describe("devicePlatform", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names an iPhone and an Android phone", () => {
    pretend(IPHONE, 5);
    expect(devicePlatform()).toBe("ios");

    pretend(ANDROID, 5);
    expect(devicePlatform()).toBe("android");
  });

  // iPadOS answers the user agent of a Mac; the touch points are the only thing that differ.
  it("tells an iPad from a Mac", () => {
    pretend(IPAD, 5);
    expect(devicePlatform()).toBe("ios");

    pretend(MAC, 0);
    expect(devicePlatform()).toBe("desktop");
  });

  // The bug this replaces: a laptop with a touch screen was handed the iPhone's install steps.
  it("leaves a touch-screen Windows laptop a desktop", () => {
    pretend(TOUCH_WINDOWS, 10);

    expect(devicePlatform()).toBe("desktop");
  });
});

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1";
const IPHONE_IN_APP =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const SAMSUNG_TABLET =
  "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const ANDROID_FIREFOX = "Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0";
const MAC_CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAC_EDGE = `${MAC_CHROME} Edg/131.0.0.0`;
const MAC_FIREFOX =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0";
const DESKTOP_MODE_TABLET =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const DESKTOP_MODE_SAMSUNG =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36";
const WINDOWS_SAMSUNG =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Safari/537.36";
const WINDOWS_FIREFOX =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0";

describe("installGuide", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tells Safari on an iPhone or iPad from every other iOS browser", () => {
    pretend(IPHONE_SAFARI, 5);
    expect(installGuide()).toBe("ios-safari");

    pretend(IPAD_SAFARI, 5);
    expect(installGuide()).toBe("ios-safari");

    pretend(IPHONE_CHROME, 5);
    expect(installGuide()).toBe("ios-other");

    pretend(IPHONE_IN_APP, 5);
    expect(installGuide()).toBe("ios-other");
  });

  // T-197: Samsung Internet carries Chrome's token too, so it is looked for first.
  it("names Samsung Internet apart from the other Android browsers", () => {
    pretend(SAMSUNG_TABLET, 10);
    expect(installGuide()).toBe("samsung");

    pretend(ANDROID_CHROME, 5);
    expect(installGuide()).toBe("android");

    pretend(ANDROID_FIREFOX, 5);
    expect(installGuide()).toBe("android");
  });

  // Chrome on a large Android tablet asks for desktop sites by default, and drops the Android token.
  it("keeps an Android tablet in desktop mode an Android, and a Linux desktop a desktop", () => {
    pretend(DESKTOP_MODE_TABLET, 10);
    expect(devicePlatform()).toBe("android");
    expect(installGuide()).toBe("android");

    pretend(DESKTOP_MODE_SAMSUNG, 10);
    expect(installGuide()).toBe("samsung");

    pretend(DESKTOP_MODE_TABLET, 0);
    expect(devicePlatform()).toBe("desktop");
  });

  it("sends only an Android to Chrome, never Samsung Internet on a computer", () => {
    pretend(WINDOWS_SAMSUNG, 0);

    expect(installGuide()).toBe("desktop");
  });

  it("gives Safari on a Mac its own steps and every other desktop browser the common ones", () => {
    pretend(IPAD_SAFARI, 0);
    expect(installGuide()).toBe("mac-safari");

    for (const agent of [MAC_CHROME, MAC_EDGE, MAC_FIREFOX, WINDOWS_FIREFOX, TOUCH_WINDOWS]) {
      pretend(agent, 0);
      expect(installGuide()).toBe("desktop");
    }
  });
});

describe("chromeIntentUrl", () => {
  // Without Chrome the page stays where it was, and its line below the button says what to do.
  it("opens the same page in Chrome, and falls back to that page where Chrome is missing", () => {
    const url = chromeIntentUrl(new URL("https://ledger.example/es/home?from=card#top"));

    expect(url).toBe(
      "intent://ledger.example/es/home?from=card#Intent;scheme=https;package=com.android.chrome;" +
        "S.browser_fallback_url=https%3A%2F%2Fledger.example%2Fes%2Fhome%3Ffrom%3Dcard;end",
    );
  });

  it("keeps the port and the scheme of the page it came from", () => {
    expect(chromeIntentUrl(new URL("http://192.168.1.5:3001/settings"))).toMatch(
      /^intent:\/\/192\.168\.1\.5:3001\/settings#Intent;scheme=http;/,
    );
  });
});
