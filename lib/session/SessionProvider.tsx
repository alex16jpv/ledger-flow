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
} from "react";

import { setUnauthorizedHandler } from "@/lib/api/client";
import { noteRefreshedElsewhere, refreshSession } from "@/lib/api/refresh";
import { purgeVault } from "@/lib/local/purge";
import { purgePersistedCaches } from "@/lib/query/purge";
import { themeStore } from "@/lib/theme/store";
import type { User } from "@/types/api";

import { fetchCurrentUser, requestLogout, requestLogoutAll } from "./api";
import { tabChannel } from "./channel";
import { sessionKeys } from "./keys";

export type SessionStatus = "loading" | "authenticated" | "expired" | "error";

interface SessionContextValue {
  status: SessionStatus;
  user: User | null;
  expired: boolean;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  refetch: () => Promise<unknown>;
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

  const query = useQuery({
    queryKey: sessionKeys.me(),
    queryFn: fetchCurrentUser,
    initialData: initialUser ? { user: initialUser } : undefined,
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    setUnauthorizedHandler((_error, context) => refreshSession({ since: context.startedAt }));
    return () => {
      setUnauthorizedHandler(null);
    };
  }, []);

  const userId = query.data?.user.id ?? null;

  // Explicit logout only: an expired session leaves the vault alone, because the app keeps working
  // offline and its queue outlives the session (D-7, invariant 7). The mirror always goes, so the
  // next user on this device sees nothing; unsent work is kept until O-F5a can offer the choice.
  const endLocalSession = useCallback(async () => {
    queryClient.clear();
    await purgePersistedCaches();
    if (!userId) return;
    const outcome = await purgeVault(userId);
    if (outcome.operationsKept > 0) {
      console.warn(`ledger-flow: kept ${outcome.operationsKept} unsent operations after logout`);
    }
  }, [queryClient, userId]);

  useEffect(() => {
    return tabChannel.subscribe((message) => {
      switch (message.type) {
        case "session:expired":
          setExpired(true);
          break;
        case "session:logout":
          void endLocalSession().then(onSignedOut);
          break;
        case "session:refreshed":
          noteRefreshedElsewhere(message.at);
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
    mutationFn: requestLogout,
    onSettled: async () => {
      await endLocalSession();
      tabChannel.post({ type: "session:logout" });
      onSignedOut();
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: requestLogoutAll,
    onSettled: async () => {
      await endLocalSession();
      tabChannel.post({ type: "session:logout" });
      onSignedOut();
    },
  });

  const setUser = useCallback(
    (user: User) => {
      queryClient.setQueryData(sessionKeys.me(), { user });
    },
    [queryClient],
  );

  const status: SessionStatus = expired
    ? "expired"
    : query.data
      ? "authenticated"
      : query.isError
        ? "error"
        : "loading";

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      user: query.data?.user ?? null,
      expired,
      logout: async () => {
        await logoutMutation.mutateAsync().catch(() => undefined);
      },
      logoutAll: async () => {
        await logoutAllMutation.mutateAsync().catch(() => undefined);
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
