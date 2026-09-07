import { openTestVault, wipeVaults } from "@/lib/testing/vault";

import {
  aheadOfServer,
  clockOffsetMs,
  loadClockOffset,
  rememberServerTime,
  resetClockOffset,
  serverNow,
} from "./clock";

const DAY = 24 * 60 * 60 * 1000;
const SERVER = "2026-09-22T18:12:00.000Z";
const server = Date.parse(SERVER);

afterEach(async () => {
  resetClockOffset();
  await wipeVaults();
});

describe("how far this device's clock runs from the server's", () => {
  it("learns the distance from the answer and keeps it for the next session", async () => {
    const vault = await openTestVault("u1");

    await rememberServerTime(vault.db, SERVER, server + 3 * DAY);

    expect(clockOffsetMs()).toBe(3 * DAY);
    expect(serverNow(server + 3 * DAY)).toBe(server);

    resetClockOffset();
    await loadClockOffset(vault.db);
    expect(clockOffsetMs()).toBe(3 * DAY);
  });

  // A write per round for a number that did not move is a write nobody asked for.
  it("does not rewrite the vault for a distance that barely moved", async () => {
    const vault = await openTestVault("u1");
    await rememberServerTime(vault.db, SERVER, server + 3 * DAY);
    await rememberServerTime(vault.db, SERVER, server + 3 * DAY + 1_000);

    expect(clockOffsetMs()).toBe(3 * DAY + 1_000);
    expect((await vault.db.get("meta", "clockOffsetMs"))?.value).toBe(3 * DAY);
  });

  it("says nothing about a distance too small to refuse a date", () => {
    expect(aheadOfServer(5 * 60_000)).toBeNull();
    expect(aheadOfServer(-3 * DAY)).toBeNull();
  });

  it("says it in days once it is worth days, and in hours below that", () => {
    expect(aheadOfServer(3 * DAY)).toEqual({ unit: "days", count: 3 });
    expect(aheadOfServer(3 * 60 * 60 * 1000)).toEqual({ unit: "hours", count: 3 });
  });

  it("ignores an answer with a date it cannot read", async () => {
    const vault = await openTestVault("u1");
    await rememberServerTime(vault.db, "not a date", server);
    expect(clockOffsetMs()).toBe(0);
  });
});
