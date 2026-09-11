"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditTransactionScreen } from "../../TransactionFormScreen";

// F-48: the id comes from the URL, not `params`: the worker serves one entry per template.
export function EditTransactionRoute() {
  const id = useDetailRouteId();
  return id ? <EditTransactionScreen id={id} /> : null;
}
