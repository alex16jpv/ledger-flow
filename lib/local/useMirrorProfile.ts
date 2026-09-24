"use client";

import { useQuery } from "@tanstack/react-query";

import { reportError } from "@/lib/observability/reporter";
import { QUERY_DOMAINS } from "@/lib/query/domains";
import type { User } from "@/types/api";

import { readMirrorProfile } from "./repository/profile";

export const profileKeys = {
  all: QUERY_DOMAINS.profile,
  mirror: () => [...QUERY_DOMAINS.profile, "mirror"] as const,
};

async function readReported(): Promise<User | null> {
  try {
    return await readMirrorProfile();
  } catch (error) {
    reportError(error, "vault");
    throw error;
  }
}

export interface MirrorProfile {
  user: User | null;
  pending: boolean;
}

// F-63: the profile the last pull stored; a mirror-backed domain, so F-38 refreshes it.
export function useMirrorProfile(enabled: boolean): MirrorProfile {
  const query = useQuery({ queryKey: profileKeys.mirror(), queryFn: readReported, enabled });
  return { user: query.data ?? null, pending: enabled && query.isPending };
}
