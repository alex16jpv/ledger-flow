import { readStorageDurability, requestPersistentStorage } from "./persist";

const original = Object.getOwnPropertyDescriptor(navigator, "storage");

function useStorage(storage: Partial<StorageManager> | undefined): void {
  Object.defineProperty(navigator, "storage", { value: storage, configurable: true });
}

afterEach(() => {
  if (original) Object.defineProperty(navigator, "storage", original);
  else useStorage(undefined);
});

describe("requestPersistentStorage", () => {
  it("does not ask again once the grant is already held", async () => {
    const persist = vi.fn();
    useStorage({
      persisted: vi.fn().mockResolvedValue(true),
      persist,
      estimate: vi.fn().mockResolvedValue({ usage: 1024, quota: 4096 }),
    });

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: true,
      persisted: true,
      usageBytes: 1024,
      quotaBytes: 4096,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("asks for the grant when it is not held yet", async () => {
    const persist = vi.fn().mockResolvedValue(true);
    useStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist,
      estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
    });

    await expect(requestPersistentStorage()).resolves.toMatchObject({ persisted: true });
    expect(persist).toHaveBeenCalledOnce();
  });

  it("reports a denial as a denial, still with the estimate", async () => {
    useStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist: vi.fn().mockResolvedValue(false),
      estimate: vi.fn().mockResolvedValue({ usage: 512, quota: 8192 }),
    });

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: true,
      persisted: false,
      usageBytes: 512,
      quotaBytes: 8192,
    });
  });

  it("treats a browser that throws as a denial rather than crashing the vault", async () => {
    useStorage({
      persisted: vi.fn().mockRejectedValue(new Error("denied")),
      persist: vi.fn(),
      estimate: vi.fn().mockResolvedValue({ usage: 1, quota: 2 }),
    });

    await expect(requestPersistentStorage()).resolves.toMatchObject({
      supported: true,
      persisted: false,
      usageBytes: 1,
    });
  });

  it("says it is unsupported where the Storage API is missing", async () => {
    useStorage(undefined);
    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: false,
      persisted: false,
      usageBytes: null,
      quotaBytes: null,
    });
  });

  it("reports null figures when the estimate is unavailable", async () => {
    useStorage({
      persisted: vi.fn().mockResolvedValue(true),
      persist: vi.fn(),
      estimate: vi.fn().mockRejectedValue(new Error("no")),
    });

    await expect(requestPersistentStorage()).resolves.toEqual({
      supported: true,
      persisted: true,
      usageBytes: null,
      quotaBytes: null,
    });
  });
});

describe("readStorageDurability", () => {
  it("reads the grant without ever asking for it", async () => {
    const persist = vi.fn();
    useStorage({
      persisted: vi.fn().mockResolvedValue(false),
      persist,
      estimate: vi.fn().mockResolvedValue({ usage: 3, quota: 9 }),
    });

    await expect(readStorageDurability()).resolves.toEqual({
      supported: true,
      persisted: false,
      usageBytes: 3,
      quotaBytes: 9,
    });
    expect(persist).not.toHaveBeenCalled();
  });

  it("says it is unsupported where the Storage API is missing", async () => {
    useStorage(undefined);
    await expect(readStorageDurability()).resolves.toMatchObject({ supported: false });
  });
});
