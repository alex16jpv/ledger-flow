import { connectivityStore, reportOnline } from "@/lib/network/connectivity";
import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import { expectVault, mirrorPage, read, resetVaultGate, setCurrentVault } from "./read";

afterEach(async () => {
  setCurrentVault(null);
  resetVaultGate();
  connectivityStore.reset();
  await wipeVaults();
});

async function readyVault(userId: string) {
  const vault = await openTestVault(userId);
  await vault.db.put("meta", { key: "syncedAt", value: "2026-09-03T12:00:00.000Z" });
  setCurrentVault(vault);
  return vault;
}

describe("read", () => {
  it("goes to the server while there is network, mirror or not", async () => {
    await readyVault("u1");
    const fromServer = vi.fn().mockResolvedValue("server");
    const fromMirror = vi.fn().mockResolvedValue("mirror");

    await expect(read(fromServer, fromMirror)).resolves.toBe("server");
    expect(fromMirror).not.toHaveBeenCalled();
  });

  it("answers from the mirror once the app has no network", async () => {
    await readyVault("u1");
    reportOnline(false);
    const fromServer = vi.fn().mockResolvedValue("server");

    await expect(read(fromServer, () => Promise.resolve("mirror"))).resolves.toBe("mirror");
    expect(fromServer).not.toHaveBeenCalled();
  });

  it("goes to the server when no vault is open", async () => {
    reportOnline(false);
    const fromMirror = vi.fn().mockResolvedValue("mirror");

    await expect(read(() => Promise.resolve("server"), fromMirror)).resolves.toBe("server");
    expect(fromMirror).not.toHaveBeenCalled();
  });

  // A mirror stopped halfway through its first snapshot holds a fraction of the data; answering
  // from it would look like an empty account instead of a failed read.
  it("goes to the server when no pull has ever finished", async () => {
    const vault = await openTestVault("u1");
    setCurrentVault(vault);
    reportOnline(false);
    const fromMirror = vi.fn().mockResolvedValue("mirror");

    await expect(read(() => Promise.resolve("server"), fromMirror)).resolves.toBe("server");
    expect(fromMirror).not.toHaveBeenCalled();
  });

  // F-31: the screens query before the frame has opened the vault, and a read that decided then
  // went to the server with a full mirror sitting there.
  it("waits for the vault the frame is about to open before deciding", async () => {
    expectVault();
    reportOnline(false);
    const fromServer = vi.fn().mockResolvedValue("server");
    const answer = read(fromServer, () => Promise.resolve("mirror"));

    await Promise.resolve();
    expect(fromServer).not.toHaveBeenCalled();

    await readyVault("u1");
    await expect(answer).resolves.toBe("mirror");
    expect(fromServer).not.toHaveBeenCalled();
  });

  it("stops waiting when no vault opens", async () => {
    expectVault();
    reportOnline(false);
    const answer = read(
      () => Promise.resolve("server"),
      () => Promise.resolve("mirror"),
    );

    setCurrentVault(null);
    await expect(answer).resolves.toBe("server");
  });

  it("falls through to the server when the mirror cannot answer", async () => {
    await readyVault("u1");
    reportOnline(false);
    const fromServer = vi.fn().mockRejectedValue(new Error("Network request failed"));

    await expect(read(fromServer, () => Promise.resolve(undefined))).rejects.toThrow(
      "Network request failed",
    );
    expect(fromServer).toHaveBeenCalledOnce();
  });
});

describe("mirrorPage", () => {
  it("pages like the API does, cursoring on the last id", () => {
    const rows = [{ id: "a1" }, { id: "a2" }, { id: "a3" }];

    expect(mirrorPage(rows, 2)).toEqual({
      data: [{ id: "a1" }, { id: "a2" }],
      pagination: { limit: 2, offset: 0, total: 3, hasMore: true, nextCursor: "a2" },
    });
    expect(mirrorPage(rows, 100).pagination).toEqual({
      limit: 100,
      offset: 0,
      total: 3,
      hasMore: false,
      nextCursor: null,
    });
    expect(mirrorPage([], 100).pagination.nextCursor).toBeNull();
  });
});
