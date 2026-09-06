"use client";

import { useQuery } from "@tanstack/react-query";

import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { User } from "@/types/api";

import { readMirrorProfile } from "./repository/profile";

export const profileKeys = {
  all: QUERY_DOMAINS.profile,
  mirror: () => [...QUERY_DOMAINS.profile, "mirror"] as const,
};

// Who the user is when the session cannot say — an offline cold start, or local mode (§2.6): the
// profile the last pull stored (F-63). A mirror-backed domain, so the pull that brings it refreshes
// it like every other read (F-38) and no network does not pause it.
export function useMirrorProfile(enabled: boolean): User | null {
  const query = useQuery({ queryKey: profileKeys.mirror(), queryFn: readMirrorProfile, enabled });
  return query.data ?? null;
}
