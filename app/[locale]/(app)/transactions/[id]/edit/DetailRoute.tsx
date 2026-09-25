"use client";

import { useDetailRouteId } from "@/lib/navigation/detail";

import { EditTransactionScreen } from "../../TransactionFormScreen";

// F-48: the id comes from the URL and keys the screen: one cached payload serves every row.
export function EditTransactionRoute() {
  const id = useDetailRouteId();
  return id ? <EditTransactionScreen key={id} id={id} /> : null;
}
