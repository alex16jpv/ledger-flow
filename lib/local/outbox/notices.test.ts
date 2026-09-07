import { openTestVault, profile, transaction, wipeVaults } from "@/lib/testing/vault";

import { setCurrentVault } from "../repository/read";
import { profileRecord, transactionRecord } from "../schema";
import { pruneNotices, readNotices, recordNotices, type SyncNotice } from "./notices";
import { type VaultDb, writeTransaction } from "./queue";

const AT = "2026-09-06T10:00:00.000Z";

const dropped = (id: string): SyncNotice => ({
  code: "CATEGORY_ARCHIVED_DROPPED",
  id,
  at: AT,
});

async function record(db: VaultDb, notices: SyncNotice[]): Promise<void> {
  const tx = writeTransaction(db);
  await recordNotices(tx, notices);
  await tx.done;
}

async function vault() {
  const handle = await openTestVault("u1");
  await handle.db.put("profile", profileRecord(profile()));
  setCurrentVault(handle);
  return handle;
}

afterEach(async () => {
  setCurrentVault(null);
  await wipeVaults();
});

describe("what the server warned about a write that landed degraded", () => {
  it("keeps one notice per row, the last one told", async () => {
    const { db } = await vault();

    await record(db, [dropped("t1"), dropped("t2")]);
    await record(db, [{ ...dropped("t1"), at: "2026-09-07T10:00:00.000Z" }]);

    expect(await readNotices(db)).toEqual([
      dropped("t2"),
      { ...dropped("t1"), at: "2026-09-07T10:00:00.000Z" },
    ]);
  });

  it("reads back nothing when there is nothing, and survives a value nobody can parse", async () => {
    const { db } = await vault();

    expect(await readNotices(db)).toEqual([]);

    await db.put("meta", { key: "syncNotices", value: "{not json" });
    expect(await readNotices(db)).toEqual([]);
  });

  it("drops the notice once its row does not need a review any more", async () => {
    const { db } = await vault();
    await db.put(
      "transactions",
      transactionRecord({ ...transaction({ id: "t1" }), pendingDetails: true }),
    );
    await db.put(
      "transactions",
      transactionRecord({ ...transaction({ id: "t2" }), pendingDetails: false }),
    );
    // t3 is not in the mirror at all: purged, or never pulled.
    await record(db, [dropped("t1"), dropped("t2"), dropped("t3")]);

    expect(await pruneNotices(db)).toEqual([dropped("t1")]);
    expect(await readNotices(db)).toEqual([dropped("t1")]);
  });

  it("drops the notice of a movement that was deleted", async () => {
    const { db } = await vault();
    await db.put(
      "transactions",
      transactionRecord({
        ...transaction({ id: "t1" }),
        pendingDetails: true,
        deletedAt: AT,
      }),
    );
    await record(db, [dropped("t1")]);

    expect(await pruneNotices(db)).toEqual([]);
  });
});
