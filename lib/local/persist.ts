export interface StorageDurability {
  supported: boolean;
  persisted: boolean;
  usageBytes: number | null;
  quotaBytes: number | null;
}

const UNSUPPORTED: StorageDurability = {
  supported: false,
  persisted: false,
  usageBytes: null,
  quotaBytes: null,
};

// The DOM types say navigator.storage is always there; older Safari and several in-app WebViews
// disagree, and this is exactly where the app has to keep working when it is missing.
function storageManager(): StorageManager | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as { storage?: StorageManager }).storage ?? null;
}

async function estimate(): Promise<Pick<StorageDurability, "usageBytes" | "quotaBytes">> {
  const storage = storageManager();
  if (!storage || typeof storage.estimate !== "function") {
    return { usageBytes: null, quotaBytes: null };
  }
  try {
    const { usage, quota } = await storage.estimate();
    return { usageBytes: usage ?? null, quotaBytes: quota ?? null };
  } catch {
    return { usageBytes: null, quotaBytes: null };
  }
}

// Without the persistent grant the browser may evict IndexedDB under storage pressure, which here
// means deleting months of offline records. Safari only grants it reliably to an installed PWA.
export async function requestPersistentStorage(): Promise<StorageDurability> {
  const storage = storageManager();
  if (
    !storage ||
    typeof storage.persist !== "function" ||
    typeof storage.persisted !== "function"
  ) {
    return { ...UNSUPPORTED, ...(await estimate()) };
  }

  let persisted = false;
  try {
    persisted = (await storage.persisted()) || (await storage.persist());
  } catch {
    persisted = false;
  }
  return { supported: true, persisted, ...(await estimate()) };
}

export async function readStorageDurability(): Promise<StorageDurability> {
  const storage = storageManager();
  if (!storage || typeof storage.persisted !== "function") {
    return { ...UNSUPPORTED, ...(await estimate()) };
  }
  try {
    return { supported: true, persisted: await storage.persisted(), ...(await estimate()) };
  } catch {
    return { ...UNSUPPORTED, ...(await estimate()) };
  }
}
