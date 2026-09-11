import type { User } from "@/types/api";

import { PROFILE_KEY } from "../schema";
import { vaultReady } from "./read";

// F-63: the row `/api/auth/me` would answer, as the last pull stored it. Null before the first.
export async function readMirrorProfile(): Promise<User | null> {
  const vault = await vaultReady();
  if (!vault) return null;
  return (await vault.db.get("profile", PROFILE_KEY))?.row ?? null;
}
