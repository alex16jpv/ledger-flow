import { openTestVault, wipeVaults } from "@/lib/testing/vault";

afterEach(wipeVaults);

describe("vault transactions (T-267)", () => {
  it("leaves no unhandled rejection behind a transaction nobody awaited", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);
    const vault = await openTestVault("u1");

    vault.db.transaction("meta", "readwrite").abort();
    await new Promise((resolve) => setTimeout(resolve, 10));

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("still rejects the transaction for whoever awaits it", async () => {
    const vault = await openTestVault("u1");
    const tx = vault.db.transaction("meta", "readwrite");

    tx.abort();

    await expect(tx.done).rejects.toThrow("AbortError");
  });
});
