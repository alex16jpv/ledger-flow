"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { ApiError } from "@/lib/api/errors";
import { readSessionMarker } from "@/lib/auth/marker";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { useOffline } from "@/lib/network/useOffline";
import { reportError } from "@/lib/observability/reporter";
import { appliedProfile } from "@/lib/session/applied-profile";
import { sessionKeys } from "@/lib/session/keys";
import { useSession } from "@/lib/session/SessionProvider";
import { useAppUser } from "@/lib/session/useAppUser";
import { type Theme, themeStore, unsentTheme, useTheme } from "@/lib/theme";
import type { User } from "@/types/api";

import { saveTheme } from "./api";

const LEGACY_LOCALE_MODE_KEY = "lf.localeMode";
const THEME_LOCK = "lf-theme";
const PASSING_STATUSES = [401, 408, 429];
const DEFERRED_SWITCH_KEY = "lf.localeSwitch";

interface DeferredSwitch {
  profile: string;
  path: string;
}

function readDeferredSwitch(): DeferredSwitch | null {
  try {
    const value: unknown = JSON.parse(window.sessionStorage.getItem(DEFERRED_SWITCH_KEY) ?? "null");
    if (typeof value !== "object" || value === null) return null;
    const { profile, path } = value as Record<string, unknown>;
    return typeof profile === "string" && typeof path === "string" ? { profile, path } : null;
  } catch {
    return null;
  }
}

function writeDeferredSwitch(next: DeferredSwitch | null): void {
  try {
    if (next) window.sessionStorage.setItem(DEFERRED_SWITCH_KEY, JSON.stringify(next));
    else window.sessionStorage.removeItem(DEFERRED_SWITCH_KEY);
  } catch {
    return;
  }
}

const sameTheme = (a: Theme, b: Theme) => a.palette === b.palette && a.mode === b.mode;

const refusedForGood = (error: unknown) =>
  error instanceof ApiError &&
  error.status >= 400 &&
  error.status < 500 &&
  !PASSING_STATUSES.includes(error.status);

let sendingHere = false;

async function withThemeLock(run: () => Promise<void>): Promise<void> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks) {
    await locks.request(THEME_LOCK, { ifAvailable: true }, async (lock) => {
      if (lock) await run();
    });
    return;
  }
  if (sendingHere) return;
  sendingHere = true;
  try {
    await run();
  } finally {
    sendingHere = false;
  }
}

function sendUnsent(
  userId: string,
  onSaved: (user: User) => void,
  onRefused: () => void,
): Promise<void> {
  return withThemeLock(async () => {
    let sent: Theme | null = null;
    for (let theme = unsentTheme.read(userId); theme; theme = unsentTheme.read(userId)) {
      if (sent && sameTheme(sent, theme)) return;
      try {
        const updated = await saveTheme(userId, theme);
        sent = theme;
        unsentTheme.clear(theme);
        appliedProfile.note(userId, "theme", updated.updatedAt);
        onSaved(updated);
      } catch (error) {
        if (!refusedForGood(error)) return;
        reportError(error, "api");
        unsentTheme.clear(theme);
        onRefused();
        return;
      }
    }
  });
}

function useLastProfileRead(): number {
  const queryClient = useQueryClient();
  return useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => queryClient.getQueryState(sessionKeys.me())?.dataUpdatedAt ?? 0,
    () => 0,
  );
}

export function useChooseTheme(): (change: Partial<Theme>) => void {
  const appUserId = useAppUser()?.id;
  return useCallback(
    (change: Partial<Theme>) => {
      const before = themeStore.getSnapshot();
      const after: Theme = { ...before, ...change };
      if (sameTheme(before, after)) return;
      themeStore.set(after);
      const userId = appUserId ?? readSessionMarker()?.userId;
      if (userId) unsentTheme.mark(userId, after);
    },
    [appUserId],
  );
}

export function useProfilePreferences(): void {
  const { status, user, setUser } = useSession();
  const { palette, mode } = useTheme();
  const offline = useOffline();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const lastRead = useLastProfileRead();
  const [refusals, setRefusals] = useState(0);
  const profile =
    status === "authenticated" && user && !user.emailConfirmationRequired ? user : null;
  const userId = profile?.id;

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_LOCALE_MODE_KEY);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    const { id, updatedAt } = profile;
    if (appliedProfile.isNews(id, "theme", updatedAt) && !unsentTheme.read(id)) {
      if (profile.theme) themeStore.set(profile.theme);
      else unsentTheme.mark(id, themeStore.getSnapshot());
      appliedProfile.note(id, "theme", updatedAt);
    }
    if (appliedProfile.isNews(id, "locale", updatedAt)) {
      const key = `${id}:${updatedAt}`;
      const deferred = readDeferredSwitch();
      if (profile.locale === locale) {
        appliedProfile.note(id, "locale", updatedAt);
        writeDeferredSwitch(null);
      } else if (deferred?.profile !== key) {
        writeDeferredSwitch({ profile: key, path: pathname });
      } else if (deferred.path !== pathname) {
        const { search, hash } = window.location;
        router.replace(`${pathname}${search}${hash}`, { locale: profile.locale });
      }
    }
  }, [profile, locale, pathname, router, refusals]);

  useEffect(() => {
    if (!userId || offline || !unsentTheme.read(userId)) return;
    void sendUnsent(userId, setUser, () => {
      setRefusals((count) => count + 1);
    });
  }, [userId, offline, palette, mode, lastRead, setUser]);
}
