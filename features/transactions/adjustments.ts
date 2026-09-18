import type { Transaction } from "@/types/api";

export type AdjustmentDirection = "increase" | "decrease";

export function directionOf(adjustment: Pick<Transaction, "toAccountId">): AdjustmentDirection {
  return adjustment.toAccountId ? "increase" : "decrease";
}

export function adjustmentAccountId(
  adjustment: Pick<Transaction, "fromAccountId" | "toAccountId">,
): string | null {
  return adjustment.fromAccountId ?? adjustment.toAccountId;
}
