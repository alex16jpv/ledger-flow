"use client";

import { useSearchParams } from "next/navigation";

import { GroupExpenseScreen } from "../GroupExpenseScreen";
import { NewTransactionScreen } from "../TransactionFormScreen";

export function NewTransactionRoute() {
  const group = useSearchParams().get("group");
  return group ? <GroupExpenseScreen groupId={group} /> : <NewTransactionScreen />;
}
