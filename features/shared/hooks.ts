"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import {
  deriveJoined,
  type JoinedGroupStanding,
  type JoinedTotals,
  joinedTotals,
} from "@/lib/local/derive";
import type { WriteOffTarget } from "@/lib/local/outbox";
import { isAnswerable, type JoinedRows, type SharedLedgerRows } from "@/lib/local/repository";
import { REFERENCE_STALE_TIME_MS } from "@/lib/query/client";
import { invalidateMoneyMovement, QUERY_DOMAINS } from "@/lib/query/domains";
import type { AddParticipantsInput, Contact, RestoreInput, UpdateContactInput } from "@/types/api";

import {
  addParticipants,
  addToLedger,
  answerInvitation,
  archiveContact,
  archiveSharedGroup,
  createContact,
  createSharedExpense,
  createSharedGroup,
  deleteSettlement,
  fetchContact,
  fetchContacts,
  fetchContactsPage,
  fetchGroupInvitations,
  fetchJoined,
  fetchReceivedInvitations,
  fetchSharedLedger,
  inviteToGroup,
  leaveJoinedGroup,
  previewParticipants,
  recordSettlement,
  removeParticipant,
  restoreContact,
  restoreSharedGroup,
  saveSharedSplit,
  undoWriteOff,
  updateContact,
  updateSharedGroup,
  withdrawInvitation,
  writeOffParty,
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

export function useRecordSettlement() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: recordSettlement, onSuccess: invalidate });
}

export function useDeleteSettlement() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: deleteSettlement, onSuccess: invalidate });
}

export interface WriteOffVariables extends WriteOffTarget {
  // What is still open when you give up, which is the ceiling the decision stores.
  amount: number;
}

export function useWriteOff() {
  const invalidate = useSharedInvalidation();
  return useMutation({
    mutationFn: ({ amount, ...target }: WriteOffVariables) => writeOffParty(target, amount),
    onSuccess: invalidate,
  });
}

export function useUndoWriteOff() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: undoWriteOff, onSuccess: invalidate });
}

export function useArchiveSharedGroup() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: archiveSharedGroup, onSuccess: invalidate });
}

export function useRestoreSharedGroup() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: restoreSharedGroup, onSuccess: invalidate });
}

export function useUpdateSharedGroup() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: updateSharedGroup, onSuccess: invalidate });
}

export function useAddParticipants() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: addParticipants, onSuccess: invalidate });
}

export function useRemoveParticipant() {
  const invalidate = useSharedInvalidation();
  return useMutation({ mutationFn: removeParticipant, onSuccess: invalidate });
}

export interface PreviewVariables {
  id: string;
  body: AddParticipantsInput;
}

// It is a question, not a write: nothing is queued and nothing is stored.
export function usePreviewParticipants() {
  return useMutation({
    mutationFn: ({ id, body }: PreviewVariables) => previewParticipants(id, body),
  });
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

export function useReceivedInvitations(enabled = true) {
  return useQuery({
    queryKey: sharedKeys.received(),
    queryFn: fetchReceivedInvitations,
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled,
  });
}

// What More and the sidebar count: the invitations that can still be answered, nothing else.
export function useWaitingInvitationCount(enabled = true): number {
  const { data } = useReceivedInvitations(enabled);
  return data?.filter((invitation) => isAnswerable(invitation)).length ?? 0;
}

export function useGroupInvitations(groupId: string, enabled = true) {
  return useQuery({
    queryKey: sharedKeys.sent(groupId),
    queryFn: () => fetchGroupInvitations(groupId),
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled,
  });
}

function useInvitationInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_DOMAINS.shared });
}

export interface InviteVariables {
  groupId: string;
  contactId: string;
}

export function useInvite() {
  const invalidate = useInvitationInvalidation();
  return useMutation({
    mutationFn: ({ groupId, contactId }: InviteVariables) => inviteToGroup(groupId, contactId),
    onSuccess: invalidate,
  });
}

export interface WithdrawVariables {
  groupId: string;
  invitationId: string;
}

export function useWithdrawInvitation() {
  const invalidate = useInvitationInvalidation();
  return useMutation({
    mutationFn: ({ groupId, invitationId }: WithdrawVariables) =>
      withdrawInvitation(groupId, invitationId),
    onSuccess: invalidate,
  });
}

export interface AnswerVariables {
  id: string;
  answer: "accept" | "decline";
}

export function useAnswerInvitation() {
  const invalidate = useInvitationInvalidation();
  return useMutation({
    mutationFn: ({ id, answer }: AnswerVariables) => answerInvitation(id, answer),
    onSuccess: invalidate,
  });
}

export interface JoinedView {
  rows: JoinedRows;
  standings: Map<string, JoinedGroupStanding>;
  totals: JoinedTotals;
}

// Groups other people shared with you: read here, written only by their owner.
export function useJoinedGroups(enabled = true) {
  const query = useQuery({
    queryKey: sharedKeys.joined(),
    queryFn: fetchJoined,
    staleTime: REFERENCE_STALE_TIME_MS,
    enabled,
  });
  const view = useMemo<JoinedView | undefined>(() => {
    if (!query.data) return undefined;
    const { groups, expenses, added } = query.data;
    const standings = new Map(
      groups.map((group) => [group.id, deriveJoined(group, expenses, added)]),
    );
    return { rows: query.data, standings, totals: joinedTotals(groups, standings) };
  }, [query.data]);
  return { ...query, view };
}

export interface AddToLedgerVariables {
  groupId: string;
  expenseId: string;
  accountId: string;
  categoryId: string | null;
}

export function useAddToLedger() {
  const invalidate = useSharedInvalidation();
  return useMutation({
    mutationFn: ({ groupId, expenseId, accountId, categoryId }: AddToLedgerVariables) =>
      addToLedger(groupId, expenseId, { accountId, categoryId }),
    onSuccess: invalidate,
  });
}

export interface LeaveVariables {
  invitationId: string;
  groupId: string;
}

export function useLeaveGroup() {
  const invalidate = useInvitationInvalidation();
  return useMutation({
    mutationFn: ({ invitationId, groupId }: LeaveVariables) =>
      leaveJoinedGroup(invitationId, groupId),
    onSuccess: invalidate,
  });
}
