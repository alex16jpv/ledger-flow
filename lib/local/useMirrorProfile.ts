"use client";

import { useQuery } from "@tanstack/react-query";

import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { User } from "@/types/api";

import { readMirrorProfile } from "./repository/profile";

export const profileKeys = {
  all: QUERY_DOMAINS.profile,
  mirror: () => [...QUERY_DOMAINS.profile, "mirror"] as const,
};

// F-63: the profile the last pull stored; a mirror-backed domain, so F-38 refreshes it.
export function useMirrorProfile(enabled: boolean): User | null {
  const query = useQuery({ queryKey: profileKeys.mirror(), queryFn: readMirrorProfile, enabled });
  return query.data ?? null;
}
