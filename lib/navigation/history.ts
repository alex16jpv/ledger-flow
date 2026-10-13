"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useRouter } from "@/lib/i18n/navigation";

type Fallback = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

// In-app history: the browser exposes no way to tell whether "back" stays inside the app.
const stack: string[] = [];
let lastLength = 0;
let poppedByUser = false;
let leaving: string | null = null;

function inside(url: string, path: string): boolean {
  const pathname = url.split(/[?#]/)[0] ?? url;
  return pathname.endsWith(path) || pathname.includes(`${path}/`);
}

// Next may apply the URL before our listener runs, so the popstate flag alone is not reliable.
export function recordNavigation(url: string, historyLength: number, popped: boolean): void {
  if (stack.at(-1) === url) return;
  if (stack.at(-2) === url) {
    stack.pop();
  } else if (!popped && historyLength === lastLength && stack.length > 0) {
    stack[stack.length - 1] = url;
  } else {
    stack.push(url);
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
    };
  }, []);

  useEffect(() => {
    const url = query ? `${pathname}?${query}` : pathname;
    if (leaving !== null && inside(url, leaving)) {
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

export function stepsOutOf(path: string): number {
  const at = stack.findLastIndex((url) => !inside(url, path));
  return at < 0 ? 0 : stack.length - 1 - at;
}

// Our stack takes a push that follows a back for a replace, so landing still inside keeps going back.
export function useLeaveNavigation() {
  const router = useRouter();
  return useCallback(
    (path: string, fallback: Fallback) => {
      const steps = stepsOutOf(path);
      if (steps === 0) {
        router.replace(fallback);
        return;
      }
      stack.length -= steps;
      leaving = path;
      window.history.go(-steps);
    },
    [router],
  );
}
