"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useRouter } from "@/lib/i18n/navigation";

type Fallback = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

// In-app history: the browser exposes no way to tell whether "back" stays inside the app.
const stack: string[] = [];
let lastLength = 0;
let poppedByUser = false;
let afterTraverse = false;
const LEAVE_WINDOW_MS = 2_000;
let leaving: { path: string; since: number } | null = null;

function pathOf(url: string): string {
  return url.split(/[?#]/)[0] ?? url;
}

function inside(url: string, path: string): boolean {
  const pathname = pathOf(url);
  return pathname.endsWith(path) || pathname.includes(`${path}/`);
}

function leavingPath(): string | null {
  if (leaving && Date.now() - leaving.since > LEAVE_WINDOW_MS) leaving = null;
  return leaving?.path ?? null;
}

// Next may apply the URL before our listener runs, so the popstate flag alone is not reliable.
export function recordNavigation(url: string, historyLength: number, popped: boolean): void {
  if (stack.at(-1) === url) return;
  const top = stack.at(-1);
  if (stack.at(-2) === url) {
    stack.pop();
    afterTraverse = true;
  } else if (
    !popped &&
    historyLength === lastLength &&
    top !== undefined &&
    !(afterTraverse && pathOf(top) !== pathOf(url))
  ) {
    stack[stack.length - 1] = url;
  } else {
    stack.push(url);
    afterTraverse = popped;
  }
  lastLength = historyLength;
}

export function canGoBack(): boolean {
  return stack.length > 1;
}

export function resetHistoryForTests(): void {
  stack.length = 0;
  lastLength = 0;
  poppedByUser = false;
  afterTraverse = false;
  leaving = null;
}

export function HistoryTracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const query = search.toString();

  useEffect(() => {
    const onPop = () => {
      poppedByUser = true;
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      leaving = null;
    };
  }, []);

  useEffect(() => {
    const url = query ? `${pathname}?${query}` : pathname;
    const left = leavingPath();
    if (left !== null && inside(url, left)) {
      window.history.back();
      return;
    }
    leaving = null;
    recordNavigation(url, window.history.length, poppedByUser);
    poppedByUser = false;
  }, [pathname, query]);

  return null;
}

// Goes back only when the previous entry is one of ours; a direct link or a reload lands on the fallback.
export function useBackNavigation() {
  const router = useRouter();
  return useCallback(
    (fallback: Fallback) => {
      if (canGoBack()) router.back();
      else router.replace(fallback);
    },
    [router],
  );
}

interface NavigationEntries {
  currentEntry: { index: number } | null;
  entries(): { url: string | null; sameDocument: boolean }[];
}

// Our stack can misread a push as a replace; the Navigation API, where there is one, cannot.
function entriesUpToHere(): string[] {
  const navigation = (window as { navigation?: NavigationEntries }).navigation;
  const index = navigation?.currentEntry?.index ?? -1;
  if (!navigation || index < 0) return stack;
  const entries = navigation.entries().slice(0, index + 1);
  return entries
    .slice(entries.findLastIndex((entry) => !entry.sameDocument) + 1)
    .map(({ url }) => (url === null ? "" : new URL(url).pathname));
}

export function stepsOutOf(path: string): number {
  const entries = entriesUpToHere();
  const at = entries.findLastIndex((url) => url !== "" && !inside(url, path));
  return at < 0 ? 0 : entries.length - 1 - at;
}

export function useLeaveNavigation() {
  const router = useRouter();
  return useCallback(
    (path: string, fallback: Fallback) => {
      if (leavingPath() !== null) return;
      const steps = stepsOutOf(path);
      if (steps === 0) {
        router.replace(fallback);
        return;
      }
      stack.length = stack.findLastIndex((url) => !inside(url, path)) + 1;
      leaving = { path, since: Date.now() };
      window.history.go(-steps);
    },
    [router],
  );
}
