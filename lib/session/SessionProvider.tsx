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
import { resumeSyncEngine } from "@/lib/local/outbox/engine";
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
  logout: (options?: SignOutOptions) => Promise<void>;
  logoutAll: (options?: SignOutOptions) => Promise<void>;
  refetch: () => Promise<unknown>;
  setUser: (user: User) => void;
}

export interface SignOutOptions {
  // The user's answer to the sheet of F-34. Left out, the queue survives the logout.
  discardPendingWork?: boolean;
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
  // next user on this device sees nothing; the queue only goes if the user said so (F-34).
  const endLocalSession = useCallback(
    async ({ discardPendingWork = false }: SignOutOptions = {}) => {
      queryClient.clear();
      await purgePersistedCaches();
      if (!userId) return;
      await purgeVault(userId, { discardPendingWork });
    },
    [queryClient, userId],
  );

  useEffect(() => {
    return tabChannel.subscribe((message) => {
      switch (message.type) {
        case "session:expired":
          setExpired(true);
          break;
        case "session:logout":
          // The tab that ran the logout already applied the user's choice to the shared vault.
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
    mutationFn: ({ options }: { options: SignOutOptions }) => requestLogout().then(() => options),
    onSettled: async (_data, _error, variables) => {
      await endLocalSession(variables.options);
      tabChannel.post({ type: "session:logout" });
      onSignedOut();
    },
  });

  const logoutAllMutation = useMutation({
    mutationFn: ({ options }: { options: SignOutOptions }) =>
      requestLogoutAll().then(() => options),
    onSettled: async (_data, _error, variables) => {
      await endLocalSession(variables.options);
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

  // React Query drops an error back to pending when a query with no data refetches, so a session
  // that failed offline would read as "loading" again the moment the network returns — and whatever
  // hangs on the answer (the vault of §2.6) would be torn down and rebuilt in the gap (R-3b).
  const status: SessionStatus = expired
    ? "expired"
    : query.data
      ? "authenticated"
      : query.isError || query.isFetched
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
