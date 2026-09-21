"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import type { SharedLedgerRows } from "@/lib/local/repository";
import { REFERENCE_STALE_TIME_MS } from "@/lib/query/client";
import { invalidateMoneyMovement, QUERY_DOMAINS } from "@/lib/query/domains";
import type { Contact, RestoreInput, UpdateContactInput } from "@/types/api";

import {
  archiveContact,
  createContact,
  createSharedExpense,
  createSharedGroup,
  fetchContact,
  fetchContacts,
  fetchContactsPage,
  fetchSharedLedger,
  restoreContact,
  saveSharedSplit,
  updateContact,
} from "./api";
import { contactKeys, sharedKeys } from "./keys";
import { sectionOf, type SharedSection } from "./ledger";

export function useContactsQuery(includeArchived = false, enabled = true) {
  return useQuery({
    queryKey: contactKeys.list(includeArchived),
    queryFn: () => fetchContacts({ includeArchived }),
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled,
  });
}

export function useContactQuery(id: string, enabled = true) {
  return useQuery({
    queryKey: contactKeys.detail(id),
    queryFn: () => fetchContact(id),
    enabled,
  });
}

export const CONTACT_PICKER_PAGE = 20;

export function useContactsPage(enabled = true) {
  const query = useInfiniteQuery({
    queryKey: contactKeys.page(),
    queryFn: ({ pageParam }) =>
      fetchContactsPage({ cursor: pageParam, limit: CONTACT_PICKER_PAGE }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.pagination.hasMore ? (last.pagination.nextCursor ?? undefined) : undefined,
    enabled,
  });
  return {
    contacts: query.data?.pages.flatMap((page) => page.data) ?? [],
    total: query.data?.pages[0]?.pagination.total ?? 0,
    hasMore: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    isPending: query.isPending,
    isError: query.isError,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
  };
}

export function useSharedLedgerQuery(enabled = true) {
  return useQuery({
    queryKey: sharedKeys.ledger(),
    queryFn: fetchSharedLedger,
    // It changes through our own writes and through a pull, and both invalidate it.
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled,
  });
}

// Four screens read the same section; this is the most expensive pure computation in the client.
let memo: { rows: SharedLedgerRows; contacts: Contact[]; section: SharedSection } | null = null;

function sectionFor(rows: SharedLedgerRows, contacts: Contact[]): SharedSection {
  if (memo?.rows === rows && memo.contacts === contacts) return memo.section;
  const section = sectionOf(rows, contacts);
  memo = { rows, contacts, section };
  return section;
}

export interface SharedSectionQuery {
  section: SharedSection | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

export function useSharedSection(enabled = true): SharedSectionQuery {
  const ledger = useSharedLedgerQuery(enabled);
  // Archived people keep their name on the rows that still owe or are owed.
  const contacts = useContactsQuery(true, enabled);
  const section = useMemo(
    () => (ledger.data && contacts.data ? sectionFor(ledger.data, contacts.data) : undefined),
    [ledger.data, contacts.data],
  );
  return {
    section,
    isPending: ledger.isPending || contacts.isPending,
    isError: ledger.isError || contacts.isError,
    error: ledger.error ?? contacts.error,
    refetch: () => {
      void ledger.refetch();
      void contacts.refetch();
    },
  };
}

function useSharedInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: QUERY_DOMAINS.shared }),
      invalidateMoneyMovement(queryClient),
    ]);
  };
}

export function useCreateSharedGroup() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: createSharedGroup, onSuccess: invalidate });
}

export function useCreateSharedExpense() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: createSharedExpense, onSuccess: invalidate });
}

export function useSaveSharedSplit() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: saveSharedSplit, onSuccess: invalidate });
}

function useContactInvalidation() {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: contactKeys.all }),
      queryClient.invalidateQueries({ queryKey: QUERY_DOMAINS.shared }),
    ]);
  };
}

export function useCreateContact() {
  const invalidate = useContactInvalidation();
  return useMutation({ mutationFn: createContact, onSuccess: invalidate });
}

export function useUpdateContact(id: string) {
  const invalidate = useContactInvalidation();
  return useMutation({
    mutationFn: (input: UpdateContactInput) => updateContact(id, input),
    onSuccess: invalidate,
  });
}

export function useArchiveContact() {
  const invalidate = useContactInvalidation();
  return useMutation({ mutationFn: archiveContact, onSuccess: invalidate });
}

export interface RestoreContactVariables extends RestoreInput {
  id: string;
}

export function useRestoreContact() {
  const invalidate = useContactInvalidation();
  return useMutation({
    mutationFn: ({ id, name }: RestoreContactVariables) => restoreContact(id, name ? { name } : {}),
    onSuccess: invalidate,
  });
}
