export type DisplayMode = "installed" | "browser";

// §4.3: iOS answers `navigator.standalone`, and its two modes do not share storage.
export function displayMode(): DisplayMode {
  if (typeof window === "undefined") return "browser";
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // Old WebViews ship without matchMedia, and this runs on the path that has to keep working there.
  const standalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return legacy || standalone ? "installed" : "browser";
}
