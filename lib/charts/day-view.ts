import { createStoredChoice } from "@/lib/storage/choice";

export const DAY_VIEWS = ["bars", "calendar"] as const;
export type DayView = (typeof DAY_VIEWS)[number];

export const DEFAULT_DAY_VIEW: DayView = "bars";

// T-27 (owner, 2026-09-12): a per-browser choice, so it lives beside the palette, not on the server.
export const dayViewStore = createStoredChoice<DayView>("lf.dayView", DAY_VIEWS, DEFAULT_DAY_VIEW);

export const dayView = dayViewStore.get;
export const setDayView = dayViewStore.set;
