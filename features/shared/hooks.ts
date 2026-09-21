"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { REFERENCE_STALE_TIME_MS } from "@/lib/query/client";
import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { RestoreInput, UpdateContactInput } from "@/types/api";

import {
  archiveContact,
  createContact,
  fetchContact,
  fetchContacts,
  fetchSharedLedger,
  restoreContact,
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

export function useSharedLedgerQuery(enabled = true) {
  return useQuery({
    queryKey: sharedKeys.ledger(),
    queryFn: fetchSharedLedger,
    enabled,
  });
}

export interface SharedSectionQuery {
  section: SharedSection | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => void;
}

// The section is the ledger read through the names: neither half says anything on its own.
export function useSharedSection(enabled = true): SharedSectionQuery {
  const ledger = useSharedLedgerQuery(enabled);
  // Archived people keep their name on the rows that still owe or are owed.
  const contacts = useContactsQuery(true, enabled);
  const section = useMemo(
    () => (ledger.data && contacts.data ? sectionOf(ledger.data, contacts.data) : undefined),
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
