import { afterEach, describe, expect, it, vi } from "vitest";

import { devicePlatform } from "./platform";

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
