import { readSpending } from "@/lib/local/repository";
import type { StatsResponse } from "@/types/api";

export const STATS_TYPES = ["EXPENSE", "INCOME", "TRANSFER", "ADJUSTMENT"] as const;
export type StatsType = (typeof STATS_TYPES)[number];
export const STATS_GROUPS = ["category", "day", "tag"] as const;
export type StatsGroup = (typeof STATS_GROUPS)[number];

export interface StatsParams {
  type: StatsType;
  groupBy: StatsGroup;
  from: string;
  to: string;
}

// Stats is /stats/spending and nothing else, so the whole feature rides on the one stats seam.
export function fetchStats(params: StatsParams): Promise<StatsResponse> {
  return readSpending({ ...params });
}
