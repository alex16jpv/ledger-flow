"use client";

import { useSyncExternalStore } from "react";

import { currencyForRegion, regionOf } from "@/lib/format/currency";
import { DEFAULT_TIME_ZONE_ID } from "@/lib/format/timezone";

export interface DeviceDefaults {
  currency: string;
  timeZone: string;
  language: string;
}

const noop = () => () => undefined;

function detect(): DeviceDefaults {
  const language = navigator.language;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE_ID;
  return { language, timeZone, currency: currencyForRegion(regionOf(language)) };
}

let cached: DeviceDefaults | null = null;
const getSnapshot = () => (cached ??= detect());
const getServerSnapshot = () => null;

export function useDeviceDefaults(): DeviceDefaults | null {
  return useSyncExternalStore(noop, getSnapshot, getServerSnapshot);
}
