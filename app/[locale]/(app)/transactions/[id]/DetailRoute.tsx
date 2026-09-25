"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { TransactionDetailScreen } from "./TransactionDetailScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function TransactionDetailRoute() {
  const id = useDetailRouteId();
  return id ? <TransactionDetailScreen key={id} id={id} /> : null;
}
