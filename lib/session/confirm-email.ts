import { useSyncExternalStore } from "react";

import type { User } from "@/types/api";

interface ConfirmEmailState {
  sheetOpen: boolean;
  openings: number;
  stripeDismissedFor: string | null;
}

const INITIAL: ConfirmEmailState = { sheetOpen: false, openings: 0, stripeDismissedFor: null };

let state = INITIAL;
const listeners = new Set<() => void>();

function set(next: ConfirmEmailState): void {
  if (
    next.sheetOpen === state.sheetOpen &&
    next.openings === state.openings &&
    next.stripeDismissedFor === state.stripeDismissedFor
  ) {
    return;
  }
  state = next;
  for (const listener of listeners) listener();
}

export function openConfirmEmail(): void {
  if (!state.sheetOpen) set({ ...state, sheetOpen: true, openings: state.openings + 1 });
}

export function closeConfirmEmail(): void {
  set({ ...state, sheetOpen: false });
}

export function dismissConfirmStripe(email: string): void {
  set({ ...state, stripeDismissedFor: email });
}

export const confirmEmailStore = {
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: (): ConfirmEmailState => state,
  getServerSnapshot: (): ConfirmEmailState => INITIAL,
  reset: (): void => {
    set(INITIAL);
  },
};

const openedOnce = () => state.openings > 0;

export function useConfirmEmailOpenedOnce(): boolean {
  return useSyncExternalStore(confirmEmailStore.subscribe, openedOnce, () => false);
}

export function useConfirmEmail(): ConfirmEmailState {
  return useSyncExternalStore(
    confirmEmailStore.subscribe,
    confirmEmailStore.getSnapshot,
    confirmEmailStore.getServerSnapshot,
  );
}

// A copy stored before the field existed says nothing, and nothing is asked on its word.
export function emailUnconfirmed(user: Pick<User, "emailVerified"> | null | undefined): boolean {
  return user?.emailVerified === false;
}
