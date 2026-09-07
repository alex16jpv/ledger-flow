"use client";

import { useQuery } from "@tanstack/react-query";

import { fetchStats, type StatsParams } from "./api";
import { statsKeys } from "./keys";

export function useStatsQuery(params: StatsParams, enabled = true) {
  return useQuery({
    queryKey: statsKeys.spending(params),
    queryFn: () => fetchStats(params),
    enabled,
  });
}
