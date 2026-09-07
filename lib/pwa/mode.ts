export type DisplayMode = "installed" | "browser";

// iOS answers `navigator.standalone`; everything else answers the media query (§4.3). The two modes
// do not share storage on iOS, which is why the app has to say which one it is running in.
export function displayMode(): DisplayMode {
  if (typeof window === "undefined") return "browser";
  const legacy = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  // Old WebViews ship without matchMedia, and this runs on the path that has to keep working there.
  const standalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  return legacy || standalone ? "installed" : "browser";
}
