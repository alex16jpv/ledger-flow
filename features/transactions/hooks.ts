"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateMoneyMovement } from "@/lib/query/domains";
import type { QuickAddTransactionInput, Transaction } from "@/types/api";

import {
  deleteTransaction,
  fetchPendingCount,
  quickAddTransaction,
  updateTransaction,
} from "./api";
import { transactionKeys } from "./keys";

export function usePendingCount(enabled = true): number {
  const query = useQuery({
    queryKey: transactionKeys.pendingCount(),
    queryFn: fetchPendingCount,
    enabled,
    select: (list) => list.pagination.total,
  });
  return query.data ?? 0;
}

export interface QuickAddVariables {
  input: QuickAddTransactionInput;
  description: string | null;
  idempotencyKey: string;
}

export interface QuickAddResult {
  transaction: Transaction;
  detailsSaved: boolean;
}

// The quick endpoint takes no description: it is added with a follow-up PUT, which also clears pendingDetails when a category came along.
export async function quickAddWithDetails({
  input,
  description,
  idempotencyKey,
}: QuickAddVariables): Promise<QuickAddResult> {
  const transaction = await quickAddTransaction(input, idempotencyKey);
  if (!description) return { transaction, detailsSaved: true };
  try {
    const detailed = await updateTransaction(transaction.id, {
      description,
      ...(input.categoryId ? { pendingDetails: false } : {}),
    });
    return { transaction: detailed, detailsSaved: true };
  } catch {
    return { transaction, detailsSaved: false };
  }
}

export function useQuickAdd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: quickAddWithDetails,
    onSuccess: () => invalidateMoneyMovement(queryClient),
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => invalidateMoneyMovement(queryClient),
  });
}
