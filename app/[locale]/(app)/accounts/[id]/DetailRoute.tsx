"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { AccountDetailScreen } from "./AccountDetailScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function AccountDetailRoute() {
  const id = useDetailRouteId();
  return id ? <AccountDetailScreen id={id} /> : null;
}
