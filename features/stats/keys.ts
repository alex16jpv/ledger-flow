import { QUERY_DOMAINS } from "@/lib/query/domains";

import type { StatsParams } from "./api";

export const statsKeys = {
  all: QUERY_DOMAINS.stats,
  spending: (params: StatsParams) => [...statsKeys.all, "spending", params] as const,
};
