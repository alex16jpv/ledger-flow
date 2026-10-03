import type { QueryClient } from "@tanstack/react-query";

import { noteSessionEnded } from "@/lib/api/refresh";
import { purgeVault } from "@/lib/local/purge";
import { purgePersistedCaches } from "@/lib/query/purge";

import { requestLogout } from "./api";
import { tabChannel } from "./channel";

export interface SignOutOptions {
  // The user's answer to the sheet of F-34. Left out, the queue survives the logout.
  discardPendingWork?: boolean;
}

// D-7, invariant 7, F-34: the mirror always goes; the queue only if the user said so.
export async function forgetSessionHere(
  queryClient: QueryClient,
  userId: string | null | undefined,
  { discardPendingWork = false }: SignOutOptions = {},
): Promise<void> {
  queryClient.clear();
  await purgePersistedCaches();
  if (!userId) return;
  await purgeVault(userId, { discardPendingWork });
}

// Outside the app's frame, where no SessionProvider runs: the logout the frame's would do.
export async function signOutHere(
  queryClient: QueryClient,
  userId: string,
  options: SignOutOptions = {},
): Promise<void> {
  noteSessionEnded();
  await requestLogout().catch(() => undefined);
  await forgetSessionHere(queryClient, userId, options);
  tabChannel.post({ type: "session:logout" });
}
