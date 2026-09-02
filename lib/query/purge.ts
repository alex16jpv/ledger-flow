export const CACHE_DB_PREFIX = "lf-cache-";

export function cacheDatabaseName(userId: string): string {
  return `${CACHE_DB_PREFIX}${userId}`;
}

// Two users on one device must never see each other's data: drop every persisted cache on logout.
export async function purgePersistedCaches(): Promise<void> {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") return;
  const databases = await indexedDB.databases();
  await Promise.all(
    databases
      .map((database) => database.name)
      .filter(
        (name): name is string => typeof name === "string" && name.startsWith(CACHE_DB_PREFIX),
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
