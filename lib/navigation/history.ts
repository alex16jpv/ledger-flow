"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

import { useRouter } from "@/lib/i18n/navigation";

type Fallback = Parameters<ReturnType<typeof useRouter>["replace"]>[0];

// In-app history: the browser exposes no way to tell whether "back" stays inside the app.
const stack: string[] = [];
let lastLength = 0;
let poppedByUser = false;

// Landing on the entry below the top is a "back" whether or not popstate was observed: Next may apply
// the URL before our listener runs, so the flag alone is not reliable.
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
    recordNavigation(
      query ? `${pathname}?${query}` : pathname,
      window.history.length,
      poppedByUser,
    );
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
