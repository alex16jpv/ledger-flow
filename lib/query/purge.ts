import { VAULT_DB_PREFIX } from "@/lib/local/schema";

export const CACHE_DB_PREFIX = "lf-cache-";

export function cacheDatabaseName(userId: string): string {
  return `${CACHE_DB_PREFIX}${userId}`;
}

// Contract since O-F1: purging is never automatic. It runs on an explicit logout and nowhere else —
// not when the session expires, not when the app updates, not to reclaim space. The offline vault
// (`lf-vault-*`) is a separate database with its own rules and is never touched from here: dropping
// it would take the outbox with it, and unsent work is never discarded on this path (invariant 7).
// Use `purgeVault` from `lib/local` for that, which keeps the queue unless the user discards it.
export async function purgePersistedCaches(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
  const databases = await indexedDB.databases();
  await Promise.all(
    databases
      .map((database) => database.name)
      .filter(
        (name): name is string =>
          typeof name === "string" &&
          name.startsWith(CACHE_DB_PREFIX) &&
          !name.startsWith(VAULT_DB_PREFIX),
      )
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => {
              resolve();
            };
            request.onerror = () => {
              resolve();
            };
            request.onblocked = () => {
              resolve();
            };
          }),
      ),
  );
}
