import { readSpending } from "@/lib/local/repository";
import type { StatsResponse } from "@/types/api";

export const STATS_TYPES = ["EXPENSE", "INCOME", "TRANSFER", "ADJUSTMENT"] as const;
export type StatsType = (typeof STATS_TYPES)[number];
export const STATS_GROUPS = ["category", "day", "account", "tag"] as const;
export type StatsGroup = (typeof STATS_GROUPS)[number];
// Trends groups by month, which is a range and not one of the four views the segmented control offers.
export type StatsGrouping = StatsGroup | "month";

export interface StatsParams {
  type: StatsType;
  groupBy: StatsGrouping;
  from: string;
  to: string;
  splitBy?: "category";
}

// Stats is /stats/spending and nothing else, so the whole feature rides on the one stats seam.
export function fetchStats(params: StatsParams): Promise<StatsResponse> {
  return readSpending({ ...params });
}
