import type { User } from "@/types/api";

import { PROFILE_KEY } from "../schema";
import { vaultReady } from "./read";

// The row `/api/auth/me` would answer, as the last pull stored it: who the user is when the session
// cannot say (F-63). Null with no vault, and before the first snapshot.
export async function readMirrorProfile(): Promise<User | null> {
  const vault = await vaultReady();
  if (!vault) return null;
  return (await vault.db.get("profile", PROFILE_KEY))?.row ?? null;
}
