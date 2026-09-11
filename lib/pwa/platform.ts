export type Platform = "ios" | "android" | "desktop";

// iPadOS reports itself as a Mac and no feature test tells them apart; only the touch points do.
export function devicePlatform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "android";
  if (/iPhone|iPad|iPod/i.test(agent)) return "ios";
  return /Mac/i.test(agent) && navigator.maxTouchPoints > 1 ? "ios" : "desktop";
}
