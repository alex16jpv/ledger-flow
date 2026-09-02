"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { invalidateMoneyMovement } from "@/lib/query/domains";
import type {
  BatchUpdateTransactionsInput,
  CreateTransactionInput,
  QuickAddTransactionInput,
  Transaction,
  UpdateTransactionInput,
} from "@/types/api";

import {
  batchUpdateTransactions,
  createTransaction,
  deleteTransaction,
  fetchDailyStats,
  fetchLatestTransactions,
  fetchPendingCount,
  fetchTags,
  fetchTransaction,
  fetchTransactionsCount,
  fetchTransactionsPage,
  quickAddTransaction,
  updateTransaction,
} from "./api";
import type { ListQuery } from "./filters";
import { transactionKeys } from "./keys";

export interface PendingSummary {
  count: number;
  total: number;
}

export function usePendingSummary(enabled = true) {
  return useQuery({
    queryKey: transactionKeys.pendingCount(),
    queryFn: fetchPendingCount,
    enabled,
    select: (list): PendingSummary => ({
      count: list.pagination.total,
      total: list.summary?.totalAmount ?? 0,
    }),
  });
}

export function usePendingCount(enabled = true): number {
  return usePendingSummary(enabled).data?.count ?? 0;
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

// The quick endpoint always flags pendingDetails and takes no description: a follow-up PUT adds the
// description and, when a category was chosen, clears the flag (owner decision P-17: a category is enough).
export async function quickAddWithDetails({
  input,
  description,
  idempotencyKey,
}: QuickAddVariables): Promise<QuickAddResult> {
  const transaction = await quickAddTransaction(input, idempotencyKey);
  if (!description && !input.categoryId) return { transaction, detailsSaved: true };
  try {
    const detailed = await updateTransaction(transaction.id, {
      ...(description ? { description } : {}),
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

export function useTransactionsInfinite(query: ListQuery, enabled = true) {
  return useInfiniteQuery({
    queryKey: transactionKeys.list(query),
    queryFn: ({ pageParam }) => fetchTransactionsPage(query, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.pagination.hasMore ? (last.pagination.nextCursor ?? undefined) : undefined,
    enabled,
  });
}

// Home shows the latest movements with the ones still to review first: two small lists, merged.
export function useRecentTransactions(limit = 5) {
  const pending = useQuery({
    queryKey: transactionKeys.list({ pendingDetails: "true", latest: limit }),
    queryFn: () => fetchLatestTransactions({ pendingDetails: "true" }, limit),
  });
  const latest = useQuery({
    queryKey: transactionKeys.list({ latest: limit }),
    queryFn: () => fetchLatestTransactions({}, limit),
  });
  const pendingRows = pending.data?.data;
  const latestRows = latest.data?.data;
  const rows = useMemo<Transaction[] | undefined>(() => {
    if (!pendingRows || !latestRows) return undefined;
    const seen = new Set(pendingRows.map((row) => row.id));
    return [...pendingRows, ...latestRows.filter((row) => !seen.has(row.id))].slice(0, limit);
  }, [pendingRows, latestRows, limit]);
  return {
    rows,
    isPending: pending.isPending || latest.isPending,
    error: pending.error ?? latest.error,
    refetch: () => Promise.all([pending.refetch(), latest.refetch()]),
  };
}

export function useTransactionsCount(query: ListQuery, enabled = true) {
  return useQuery({
    queryKey: transactionKeys.count(query),
    queryFn: () => fetchTransactionsCount(query),
    select: (list) => list.pagination.total,
    enabled,
  });
}

export interface PeriodTotals {
  spent: number;
  income: number;
  byDay: ReadonlyMap<string, number>;
}

// Day headers and the summary come from the server's day buckets; the client only pairs them up.
export function usePeriodTotals(window: { from: string; to: string } | null) {
  const from = window?.from ?? "";
  const to = window?.to ?? "";
  const expenses = useQuery({
    queryKey: transactionKeys.daily({ type: "EXPENSE", from, to }),
    queryFn: () => fetchDailyStats({ type: "EXPENSE", from, to }),
    enabled: window !== null,
  });
  const income = useQuery({
    queryKey: transactionKeys.daily({ type: "INCOME", from, to }),
    queryFn: () => fetchDailyStats({ type: "INCOME", from, to }),
    enabled: window !== null,
  });
  const expenseData = expenses.data;
  const incomeData = income.data;
  return useMemo<PeriodTotals | null>(() => {
    if (!expenseData || !incomeData) return null;
    const byDay = new Map<string, number>();
    for (const bucket of incomeData.buckets) byDay.set(bucket.key, bucket.total);
    for (const bucket of expenseData.buckets)
      byDay.set(bucket.key, (byDay.get(bucket.key) ?? 0) - bucket.total);
    return { spent: expenseData.total, income: incomeData.total, byDay };
  }, [expenseData, incomeData]);
}

export function useTransactionQuery(id: string) {
  return useQuery({ queryKey: transactionKeys.detail(id), queryFn: () => fetchTransaction(id) });
}

export function useTagsQuery() {
  return useQuery({
    queryKey: transactionKeys.tags(),
    queryFn: fetchTags,
    select: (list) => list.data,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: CreateTransactionInput;
      idempotencyKey: string;
    }) => createTransaction(input, idempotencyKey),
    onSuccess: () => invalidateMoneyMovement(queryClient),
  });
}

export function useUpdateTransaction(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTransactionInput) => updateTransaction(id, input),
    onSuccess: () => invalidateMoneyMovement(queryClient),
  });
}

export function useBatchComplete() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      input,
      idempotencyKey,
    }: {
      input: BatchUpdateTransactionsInput;
      idempotencyKey: string;
    }) => batchUpdateTransactions(input, idempotencyKey),
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
