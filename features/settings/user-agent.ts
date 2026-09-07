export type DeviceKind = "phone" | "laptop" | "desktop";

export interface DeviceDescription {
  kind: DeviceKind;
  label: string | null;
}

const OS: [RegExp, string][] = [
  [/iPhone|iPad/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];
const BROWSER: [RegExp, string][] = [
  [/Edg\//, "Edge"],
  [/OPR\//, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

// Enough to tell a session apart ("Android · Chrome"); a full UA parser is not worth its weight here.
export function describeUserAgent(userAgent: string | undefined): DeviceDescription {
  if (!userAgent) return { kind: "desktop", label: null };
  const os = OS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const browser = BROWSER.find(([pattern]) => pattern.test(userAgent))?.[1];
  const kind: DeviceKind = /Mobile|iPhone|Android/.test(userAgent)
    ? "phone"
    : /Macintosh|Windows/.test(userAgent)
      ? "laptop"
      : "desktop";
  const label = [os, browser].filter(Boolean).join(" · ");
  return { kind, label: label || null };
}
