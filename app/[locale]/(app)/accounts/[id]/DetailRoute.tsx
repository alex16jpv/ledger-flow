"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { AccountDetailScreen } from "./AccountDetailScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function AccountDetailRoute() {
  const id = useDetailRouteId();
  return id ? <AccountDetailScreen key={id} id={id} /> : null;
}
