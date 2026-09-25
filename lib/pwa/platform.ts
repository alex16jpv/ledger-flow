export type Platform = "ios" | "android" | "desktop";

export type InstallGuide =
  "ios-safari" | "ios-other" | "samsung" | "android" | "mac-safari" | "desktop";

// iPadOS reports itself as a Mac and no feature test tells them apart; only the touch points do.
export function devicePlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "android";
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  const touch = navigator.maxTouchPoints > 1;
  if (/Mac/i.test(agent) && touch) return "ios";
  // An Android tablet that asks for desktop sites says Linux x86_64; only its touch points tell.
  return agent.includes("X11; Linux x86_64") && touch ? "android" : "desktop";
}

// Every iOS browser is WebKit and says Safari; the others add their own token, an in-app one drops Safari.
const IOS_OTHER = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//;
// Chromium on a Mac says Safari too, but never Version/ before it.
const MAC_SAFARI = /Macintosh.*Version\/[\d.]+.*Safari\//;

export function installGuide(): InstallGuide {
  if (typeof navigator === "undefined") return "desktop";
  const agent = navigator.userAgent;
  const platform = devicePlatform();
  if (platform === "android" && agent.includes("SamsungBrowser")) return "samsung";
  if (platform === "ios") {
    return IOS_OTHER.test(agent) || !agent.includes("Safari/") ? "ios-other" : "ios-safari";
  }
  if (platform === "android") return "android";
  return MAC_SAFARI.test(agent) ? "mac-safari" : "desktop";
}

const CHROME_PACKAGE = "com.android.chrome";

export function chromeIntentUrl(page: URL): string {
  const scheme = page.protocol.replace(/:$/, "");
  const here = `${page.host}${page.pathname}${page.search}`;
  const fallback = encodeURIComponent(`${scheme}://${here}`);
  return `intent://${here}#Intent;scheme=${scheme};package=${CHROME_PACKAGE};S.browser_fallback_url=${fallback};end`;
}
