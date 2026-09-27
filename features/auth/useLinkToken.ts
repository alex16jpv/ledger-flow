"use client";

import { useSyncExternalStore } from "react";

import { keepLinkToken, keptLinkToken, type LinkPurpose } from "./carry";

const TOKEN_PARAM = "token";

const noSubscription = () => () => undefined;
const notReadYet = () => undefined;

// Keeps Next's history state: its patched replaceState would restore a route and stall the next navigation.
function takeTokenFromAddress(purpose: LinkPurpose): string | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1)).get(TOKEN_PARAM);
  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }
  if (fragment) keepLinkToken(purpose, fragment);
  return fragment ?? keptLinkToken(purpose);
}

// Undefined until the page runs in the browser, null when the address brought no token.
export function useLinkToken(purpose: LinkPurpose): string | null | undefined {
  return useSyncExternalStore(noSubscription, () => takeTokenFromAddress(purpose), notReadYet);
}
