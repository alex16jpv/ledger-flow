"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { TransactionDetailScreen } from "./TransactionDetailScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function TransactionDetailRoute() {
  const id = useDetailRouteId();
  return id ? <TransactionDetailScreen id={id} /> : null;
}
