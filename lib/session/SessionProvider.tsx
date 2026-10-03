"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { setConfirmationRequiredHandler, setUnauthorizedHandler } from "@/lib/api/client";
import { noteRefreshedElsewhere, noteSessionEnded, refreshSession } from "@/lib/api/refresh";
import { resumeSyncEngine } from "@/lib/local/outbox/engine";
import { localOnlyStore } from "@/lib/network/local-only";
import { themeStore } from "@/lib/theme/store";
import type { User } from "@/types/api";

import {
  fetchCurrentUser,
  requestLogout,
  requestLogoutAll,
  type SessionProfile,
  type SessionUser,
} from "./api";
import { tabChannel } from "./channel";
import { sessionKeys } from "./keys";
import { forgetSessionHere, type SignOutOptions } from "./sign-out";

export type SessionStatus = "loading" | "authenticated" | "expired" | "error";

interface SessionContextValue {
  status: SessionStatus;
  user: SessionProfile | null;
  expired: boolean;
  logout: (options?: SignOutOptions) => Promise<void>;
  logoutAll: (options?: SignOutOptions) => Promise<void>;
  refetch: () => Promise<{ data?: SessionUser }>;
  setUser: (user: User) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

interface SessionProviderProps {
  initialUser?: User | null;
  onSignedOut: () => void;
  onLocaleChanged?: (locale: string) => void;
  children: ReactNode;
}

export function SessionProvider({
  initialUser = null,
  onSignedOut,
  onLocaleChanged,
  children,
}: SessionProviderProps) {
  const queryClient = useQueryClient();
  const [expired, setExpired] = useState(false);

  // P-32: in this-device-only the question would sit paused for ever, so it is not asked.
  const localOnly = useSyncExternalStore(
    localOnlyStore.subscribe,
    localOnlyStore.getSnapshot,
    localOnlyStore.getServerSnapshot,
  );
  const query = useQuery({
    queryKey: sessionKeys.me(),
    queryFn: fetchCurrentUser,
    initialData: initialUser ? { user: initialUser } : undefined,
    staleTime: 5 * 60_000,
    retry: false,
    enabled: !localOnly,
    // The only read with nothing local to fall back on: with no network there is nothing to ask.
    networkMode: "online",
  });

  useEffect(() => {
    setUnauthorizedHandler((_error, context) => refreshSession({ since: context.startedAt }));
    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  // The deadline can pass with the app open: any request that meets it has the profile read again.
  useEffect(() => {
    setConfirmationRequiredHandler(() => {
      void queryClient.invalidateQueries({ queryKey: sessionKeys.me() });
    });
    return () => {
      setConfirmationRequiredHandler(null);
    };
  }, [queryClient]);

  const userId = query.data?.user.id ?? null;

  const endLocalSession = useCallback(
    (options: SignOutOptions = {}) => forgetSessionHere(queryClient, userId, options),
    [queryClient, userId],
  );

  useEffect(() => {
    return tabChannel.subscribe((message) => {
      switch (message.type) {
        case "session:expired":
          // Every tab holds its own flag, or each one posts its own refresh and files its own report.
          noteSessionEnded();
          setExpired(true);
          break;
        case "session:logout":
          // The tab that ran the logout already applied the user's choice to the shared vault.
          noteSessionEnded();
          void endLocalSession({ discardPendingWork: false }).then(onSignedOut);
          break;
        case "session:refreshed":
          noteRefreshedElsewhere(message.at);
          resumeSyncEngine();
          break;
        case "theme":
          themeStore.set(
            { palette: message.palette, mode: message.mode } as Parameters<
              typeof themeStore.set
            >[0],
            {
              persist: false,
            },
          );
          break;
        case "locale":
          onLocaleChanged?.(message.locale);
          break;
      }
    });
  }, [endLocalSession, onSignedOut, onLocaleChanged]);

  const logoutMutation = useMutation({
    mutationFn: ({ options }: { options: SignOutOptions }) => {
      noteSessionEnded();
      return requestLogout().then(() => options);
    },
    onSettled: async (_data, _error, variables) => {
      await endLocalSession(variables.options);
      tabChannel.post({ type: "session:logout" });
      onSignedOut();
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: ({ options }: { options: SignOutOptions }) => {
      noteSessionEnded();
      return requestLogoutAll().then(() => options);
    },
    onSettled: async (_data, _error, variables) => {
      await endLocalSession(variables.options);
      tabChannel.post({ type: "session:logout" });
      onSignedOut();
    },
  });

  const setUser = useCallback(
    (user: User) => {
      queryClient.setQueryData<{ user: SessionProfile }>(sessionKeys.me(), (current) => {
        if (current?.user.id !== user.id) return { user };
        const { emailVerification, emailChange } = current.user;
        return { user: { emailVerification, emailChange, ...user } };
      });
    },
    [queryClient],
  );

  // R-3b: an errored query refetching reads as loading, and §2.6's vault would be torn down.
  const answered = query.isError || query.isFetched || query.fetchStatus === "paused";
  const [wasAnswered, setWasAnswered] = useState(false);
  if (answered && !wasAnswered) setWasAnswered(true);
  const status: SessionStatus =
    localOnly || expired
      ? "expired"
      : query.data
        ? "authenticated"
        : wasAnswered
          ? "error"
          : "loading";

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: query.data?.user ?? null,
      expired,
      logout: async (options = {}) => {
        await logoutMutation.mutateAsync({ options }).catch(() => undefined);
      },
      logoutAll: async (options = {}) => {
        await logoutAllMutation.mutateAsync({ options }).catch(() => undefined);
      },
      refetch: query.refetch,
      setUser,
    }),
    [status, query.data, query.refetch, expired, logoutMutation, logoutAllMutation, setUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession requires a SessionProvider");
  return context;
}
