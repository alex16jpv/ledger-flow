"use client";

import { useMirrorProfile } from "@/lib/local/useMirrorProfile";

import { useSession } from "./SessionProvider";

// F-82: with no network the session cannot say who this is, and the mirror's profile can — the same
// fallback F-63 gave the currency. Whatever greets the user or draws their initials reads this.
export function useAppUser() {
  const session = useSession();
  const mirror = useMirrorProfile(session.user === null && session.status !== "loading");
  return session.user ?? mirror;
}
