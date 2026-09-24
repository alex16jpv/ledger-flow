import type { User } from "@/types/api";

import type { SessionStatus } from "./SessionProvider";

export interface ProfileSources {
  user: User | null;
  sessionStatus: SessionStatus;
  mirrorPending: boolean;
}

export const profileResolved = ({ user, sessionStatus, mirrorPending }: ProfileSources): boolean =>
  user !== null || (sessionStatus !== "loading" && !mirrorPending);
