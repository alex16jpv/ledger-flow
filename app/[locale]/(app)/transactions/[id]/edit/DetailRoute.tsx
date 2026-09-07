"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditTransactionScreen } from "../../TransactionFormScreen";

// The id comes from the URL, not from `params`: the worker serves this route from one entry per
// template, so the payload cannot know which row it is (F-48).
export function EditTransactionRoute() {
  const id = useDetailRouteId();
  return id ? <EditTransactionScreen id={id} /> : null;
}
