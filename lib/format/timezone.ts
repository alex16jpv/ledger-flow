export const DEFAULT_TIME_ZONE_ID = "America/Bogota";

export function listTimeZones(): string[] {
  return Intl.supportedValuesOf("timeZone");
}

export function isKnownTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

export function timeZoneOffsetLabel(zone: string, locale: string, at = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      timeZoneName: "shortOffset",
    }).formatToParts(at);
    return parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

export function timeZoneCity(zone: string): string {
  const city = zone.split("/").pop() ?? zone;
  return city.replace(/_/g, " ");
}
