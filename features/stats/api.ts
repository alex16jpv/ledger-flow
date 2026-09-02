import { api } from "@/lib/api/client";
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

export function fetchStats(params: StatsParams): Promise<StatsResponse> {
  return api<StatsResponse>("/stats/spending", { query: { ...params } });
}
