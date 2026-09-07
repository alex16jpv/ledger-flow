"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { TransactionDetailScreen } from "./TransactionDetailScreen";

// The id comes from the URL, not from `params`: the worker serves this route from one entry per
// template, so the payload cannot know which row it is (F-48).
export function TransactionDetailRoute() {
  const id = useDetailRouteId();
  return id ? <TransactionDetailScreen id={id} /> : null;
}
